import type { OHLCBar } from "./types"

export interface OrderBlock {
  type: "bull" | "bear"
  high: number
  low: number
  mid: number
  time: number
  strength: 1 | 2 | 3
}

export interface FairValueGap {
  type: "bull" | "bear"
  top: number
  bottom: number
  mid: number
  time: number
}

export interface LiquidityLevel {
  type: "buyside" | "sellside"
  price: number
  touches: number
}

export interface MarketStructure {
  bias: "BULLISH" | "BEARISH" | "RANGING"
  lastBOS: { kind: "BOS" | "CHoCH"; direction: "UP" | "DOWN"; price: number } | null
  recentSwingHigh: number
  recentSwingLow: number
  zone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM"
  inOTE: boolean
}

export interface LiquiditySweep {
  type: "bull" | "bear"  // bull = sell-side swept → bullish reversal expected
  level: number          // the swept price level
  barsAgo: number
  strength: 1 | 2 | 3   // based on wick rejection magnitude
}

export interface RSIDivergence {
  type: "bullish" | "bearish"
  strength: "regular" | "hidden"
}

export interface DailyContext {
  pdHigh: number
  pdLow: number
  weekHigh: number
  weekLow: number
  d1Bias: "UP" | "DOWN" | "NEUTRAL"
  d1OBs: OrderBlock[]
}

export interface SMCContext {
  structure: MarketStructure
  orderBlocks: OrderBlock[]      // H1 nearest 4 unmitigated
  h4OrderBlocks: OrderBlock[]    // H4 nearest 3 unmitigated (much stronger weight)
  fvgs: FairValueGap[]
  liquidity: LiquidityLevel[]
  sweeps: LiquiditySweep[]       // recent stop-hunt setups — highest quality entry
  divergence: RSIDivergence | null
  daily: DailyContext
}

// ── Swing detection (lookback=3) ───────────────────────────────

function detectSwings(bars: OHLCBar[], lookback = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = []
  const lows: number[] = []
  for (let i = lookback; i < bars.length - lookback; i++) {
    const isSwingHigh = bars.slice(i - lookback, i).every(b => b.high <= bars[i].high) &&
                        bars.slice(i + 1, i + lookback + 1).every(b => b.high <= bars[i].high)
    const isSwingLow  = bars.slice(i - lookback, i).every(b => b.low >= bars[i].low) &&
                        bars.slice(i + 1, i + lookback + 1).every(b => b.low >= bars[i].low)
    if (isSwingHigh) highs.push(bars[i].high)
    if (isSwingLow)  lows.push(bars[i].low)
  }
  return { highs, lows }
}

// ── Market Structure Analysis ──────────────────────────────────

export function analyzeStructure(bars: OHLCBar[], px: number): MarketStructure {
  const slice = bars.slice(-80)
  const { highs, lows } = detectSwings(slice, 3)

  const lastTwoHighs = highs.slice(-2)
  const lastTwoLows  = lows.slice(-2)

  const swingHigh = lastTwoHighs.length > 0 ? Math.max(...lastTwoHighs) : (slice.length > 0 ? Math.max(...slice.map(b => b.high)) : px)
  const swingLow  = lastTwoLows.length  > 0 ? Math.min(...lastTwoLows)  : (slice.length > 0 ? Math.min(...slice.map(b => b.low))  : px)

  // Determine bias from HH+HL vs LH+LL
  let bias: "BULLISH" | "BEARISH" | "RANGING" = "RANGING"
  if (lastTwoHighs.length >= 2 && lastTwoLows.length >= 2) {
    const hh = lastTwoHighs[1] > lastTwoHighs[0]
    const hl = lastTwoLows[1]  > lastTwoLows[0]
    const lh = lastTwoHighs[1] < lastTwoHighs[0]
    const ll = lastTwoLows[1]  < lastTwoLows[0]
    if (hh && hl) bias = "BULLISH"
    else if (lh && ll) bias = "BEARISH"
  }

  // lastBOS detection
  let lastBOS: MarketStructure["lastBOS"] = null
  if (lastTwoHighs.length >= 2 && lastTwoLows.length >= 2) {
    const prevHigh = lastTwoHighs[0]
    const prevLow  = lastTwoLows[0]
    if (bias === "BULLISH") {
      // BOS UP if we broke above previous swing high
      if (px > prevHigh) {
        lastBOS = { kind: "BOS", direction: "UP", price: prevHigh }
      } else {
        // CHoCH UP if we recently broke bearish low and flipped bullish
        lastBOS = { kind: "CHoCH", direction: "UP", price: prevLow }
      }
    } else if (bias === "BEARISH") {
      if (px < prevLow) {
        lastBOS = { kind: "BOS", direction: "DOWN", price: prevLow }
      } else {
        lastBOS = { kind: "CHoCH", direction: "DOWN", price: prevHigh }
      }
    }
  }

  // Zone calculation
  const range = swingHigh - swingLow
  const pos   = range > 0 ? (px - swingLow) / range : 0.5
  let zone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM"
  if (pos > 0.55)      zone = "PREMIUM"
  else if (pos < 0.45) zone = "DISCOUNT"
  else                 zone = "EQUILIBRIUM"

  // OTE: Optimal Trade Entry (62–79% retracement into the range)
  // BULLISH: price in 21–38% from the top (i.e. 62–79% from the bottom)
  // BEARISH: price in 62–79% from the bottom (i.e. 21–38% from the top)
  let inOTE = false
  if (bias === "BULLISH") {
    inOTE = pos >= 0.21 && pos <= 0.38
  } else if (bias === "BEARISH") {
    inOTE = pos >= 0.62 && pos <= 0.79
  }

  return {
    bias, lastBOS,
    recentSwingHigh: swingHigh,
    recentSwingLow:  swingLow,
    zone, inOTE,
  }
}

// ── Order Block Detection ──────────────────────────────────────

export function detectOrderBlocks(bars: OHLCBar[], px: number): OrderBlock[] {
  const slice   = bars.slice(-120)
  const len     = slice.length
  const avgSlice = slice.slice(-50)
  const avgBody = avgSlice.reduce((s, b) => s + Math.abs(b.close - b.open), 0) / (avgSlice.length || 1)

  const results: OrderBlock[] = []

  for (let i = 1; i < len - 2; i++) {
    const prev = slice[i - 1]
    const cur  = slice[i]
    const body = Math.abs(cur.close - cur.open)

    // Bullish OB: strong bullish displacement bar preceded by bearish bar
    if (cur.close > cur.open && body > avgBody * 1.4 && prev.close < prev.open) {
      // Mitigation check: any subsequent bar that trades into the OB zone
      const ob: OrderBlock = {
        type: "bull",
        high: prev.high,
        low:  prev.low,
        mid:  (prev.high + prev.low) / 2,
        time: prev.time,
        strength: body > avgBody * 2.5 ? 3 : body > avgBody * 2.0 ? 2 : 1,
      }
      const mitigated = slice.slice(i + 1).some(b => b.low <= ob.high && b.high >= ob.low)
      if (!mitigated) results.push(ob)
    }

    // Bearish OB: strong bearish displacement bar preceded by bullish bar
    if (cur.close < cur.open && body > avgBody * 1.4 && prev.close > prev.open) {
      const ob: OrderBlock = {
        type: "bear",
        high: prev.high,
        low:  prev.low,
        mid:  (prev.high + prev.low) / 2,
        time: prev.time,
        strength: body > avgBody * 2.5 ? 3 : body > avgBody * 2.0 ? 2 : 1,
      }
      const mitigated = slice.slice(i + 1).some(b => b.low <= ob.high && b.high >= ob.low)
      if (!mitigated) results.push(ob)
    }
  }

  return results.sort((a, b) => Math.abs(a.mid - px) - Math.abs(b.mid - px)).slice(0, 4)
}

// ── Fair Value Gap Detection ───────────────────────────────────

export function detectFVGs(bars: OHLCBar[], px: number): FairValueGap[] {
  const slice = bars.slice(-100)
  const len   = slice.length
  const results: FairValueGap[] = []

  for (let i = 1; i < len - 1; i++) {
    const prev = slice[i - 1]
    const next = slice[i + 1]

    // Bullish FVG: gap between prev high and next low
    if (prev.high < next.low) {
      const fvg: FairValueGap = {
        type:   "bull",
        bottom: prev.high,
        top:    next.low,
        mid:    (prev.high + next.low) / 2,
        time:   slice[i].time,
      }
      // Filled check: subsequent bars overlap the gap
      const filled = slice.slice(i + 1).some(b => b.low <= fvg.top && b.high >= fvg.bottom)
      if (!filled) results.push(fvg)
    }

    // Bearish FVG: gap between next high and prev low
    if (prev.low > next.high) {
      const fvg: FairValueGap = {
        type:   "bear",
        top:    prev.low,
        bottom: next.high,
        mid:    (prev.low + next.high) / 2,
        time:   slice[i].time,
      }
      const filled = slice.slice(i + 1).some(b => b.low <= fvg.top && b.high >= fvg.bottom)
      if (!filled) results.push(fvg)
    }
  }

  return results.sort((a, b) => Math.abs(a.mid - px) - Math.abs(b.mid - px)).slice(0, 4)
}

// ── Liquidity Level Detection ──────────────────────────────────

export function detectLiquidity(bars: OHLCBar[], px: number): LiquidityLevel[] {
  const slice     = bars.slice(-100)
  const tolerance = px * 0.0015
  const { highs, lows } = detectSwings(slice, 3)

  const results: LiquidityLevel[] = []

  // Cluster swing highs → buy-side liquidity
  const usedHighs = new Set<number>()
  for (let i = 0; i < highs.length; i++) {
    if (usedHighs.has(i)) continue
    const cluster = [highs[i]]
    for (let j = i + 1; j < highs.length; j++) {
      if (usedHighs.has(j)) continue
      if (Math.abs(highs[j] - highs[i]) <= tolerance) {
        cluster.push(highs[j])
        usedHighs.add(j)
      }
    }
    usedHighs.add(i)
    if (cluster.length >= 2) {
      const price = cluster.reduce((s, v) => s + v, 0) / cluster.length
      results.push({ type: "buyside", price, touches: cluster.length })
    }
  }

  // Cluster swing lows → sell-side liquidity
  const usedLows = new Set<number>()
  for (let i = 0; i < lows.length; i++) {
    if (usedLows.has(i)) continue
    const cluster = [lows[i]]
    for (let j = i + 1; j < lows.length; j++) {
      if (usedLows.has(j)) continue
      if (Math.abs(lows[j] - lows[i]) <= tolerance) {
        cluster.push(lows[j])
        usedLows.add(j)
      }
    }
    usedLows.add(i)
    if (cluster.length >= 2) {
      const price = cluster.reduce((s, v) => s + v, 0) / cluster.length
      results.push({ type: "sellside", price, touches: cluster.length })
    }
  }

  return results.sort((a, b) => Math.abs(a.price - px) - Math.abs(b.price - px)).slice(0, 4)
}

// ── H1 → H4 aggregation ───────────────────────────────────────

function aggregateToH4(h1Bars: OHLCBar[]): OHLCBar[] {
  const h4: OHLCBar[] = []
  for (let i = 0; i + 3 < h1Bars.length; i += 4) {
    const c = h1Bars.slice(i, i + 4)
    h4.push({
      time:   c[0].time,
      open:   c[0].open,
      high:   Math.max(...c.map(b => b.high)),
      low:    Math.min(...c.map(b => b.low)),
      close:  c[c.length - 1].close,
      volume: c.reduce((s, b) => s + (b.volume ?? 0), 0),
    })
  }
  return h4
}

// ── H1 → D1 aggregation ───────────────────────────────────────

function aggregateToD1(h1Bars: OHLCBar[]): OHLCBar[] {
  const dayMap = new Map<string, OHLCBar>()
  for (const bar of h1Bars) {
    const d = new Date(bar.time * 1000)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    const ex = dayMap.get(key)
    if (!ex) {
      dayMap.set(key, { ...bar })
    } else {
      ex.high   = Math.max(ex.high, bar.high)
      ex.low    = Math.min(ex.low, bar.low)
      ex.close  = bar.close
      ex.volume = (ex.volume ?? 0) + (bar.volume ?? 0)
    }
  }
  return Array.from(dayMap.values()).sort((a, b) => a.time - b.time)
}

// ── H4 Order Blocks ────────────────────────────────────────────

function detectH4OrderBlocks(h1Bars: OHLCBar[], px: number, h4Bars?: OHLCBar[]): OrderBlock[] {
  const h4 = h4Bars && h4Bars.length >= 5 ? h4Bars : aggregateToH4(h1Bars)
  if (h4.length < 5) return []
  return detectOrderBlocks(h4, px).slice(0, 3)
}

// ── Liquidity Sweep Detection ──────────────────────────────────

function detectLiquiditySweeps(bars: OHLCBar[]): LiquiditySweep[] {
  const slice = bars.slice(-50)
  const lb = 3
  const results: LiquiditySweep[] = []

  for (let i = lb; i < slice.length - lb - 1; i++) {
    const isHigh = slice.slice(i - lb, i).every(b => b.high <= slice[i].high) &&
                   slice.slice(i + 1, i + lb + 1).every(b => b.high <= slice[i].high)
    const isLow  = slice.slice(i - lb, i).every(b => b.low >= slice[i].low) &&
                   slice.slice(i + 1, i + lb + 1).every(b => b.low >= slice[i].low)

    if (isHigh) {
      const level = slice[i].high
      for (let j = i + lb + 1; j < Math.min(i + 16, slice.length); j++) {
        const bar = slice[j]
        if (bar.high > level && bar.close < level) {
          const barsAgo = slice.length - 1 - j
          const wickRatio = (bar.high - bar.close) / Math.max(bar.high - bar.low, 0.000001)
          results.push({ type: "bear", level, barsAgo, strength: wickRatio > 0.65 ? 3 : wickRatio > 0.45 ? 2 : 1 })
          break
        }
      }
    }

    if (isLow) {
      const level = slice[i].low
      for (let j = i + lb + 1; j < Math.min(i + 16, slice.length); j++) {
        const bar = slice[j]
        if (bar.low < level && bar.close > level) {
          const barsAgo = slice.length - 1 - j
          const wickRatio = (bar.close - bar.low) / Math.max(bar.high - bar.low, 0.000001)
          results.push({ type: "bull", level, barsAgo, strength: wickRatio > 0.65 ? 3 : wickRatio > 0.45 ? 2 : 1 })
          break
        }
      }
    }
  }

  return results.sort((a, b) => a.barsAgo - b.barsAgo).slice(0, 3)
}

// ── RSI Divergence ────────────────────────────────────────────

function calcRSISeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return closes.map(() => 50)
  const out: number[] = Array(period).fill(50)
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let ag = gains / period, al = losses / period
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    ag = (ag * (period - 1) + g) / period
    al = (al * (period - 1) + l) / period
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
  }
  return out
}

function detectRSIDivergence(bars: OHLCBar[]): RSIDivergence | null {
  if (bars.length < 30) return null
  const slice  = bars.slice(-60)
  const closes = slice.map(b => b.close)
  const rsi    = calcRSISeries(closes)
  const lb = 3

  const highs: { price: number; rsiVal: number }[] = []
  const lows:  { price: number; rsiVal: number }[] = []

  for (let i = lb; i < slice.length - lb; i++) {
    if (slice.slice(i - lb, i).every(b => b.high <= slice[i].high) &&
        slice.slice(i + 1, i + lb + 1).every(b => b.high <= slice[i].high))
      highs.push({ price: slice[i].high, rsiVal: rsi[i] })
    if (slice.slice(i - lb, i).every(b => b.low >= slice[i].low) &&
        slice.slice(i + 1, i + lb + 1).every(b => b.low >= slice[i].low))
      lows.push({ price: slice[i].low, rsiVal: rsi[i] })
  }

  // Bearish: price HH but RSI LH → momentum diverging at top
  if (highs.length >= 2) {
    const [h1, h2] = highs.slice(-2)
    if (h2.price > h1.price && h2.rsiVal < h1.rsiVal)
      return { type: "bearish", strength: "regular" }
  }

  // Bullish: price LL but RSI HL → momentum diverging at bottom
  if (lows.length >= 2) {
    const [l1, l2] = lows.slice(-2)
    if (l2.price < l1.price && l2.rsiVal > l1.rsiVal)
      return { type: "bullish", strength: "regular" }
  }

  return null
}

// ── Daily Context (aggregated from H1) ────────────────────────

function buildDailyContext(h1Bars: OHLCBar[], px: number): DailyContext {
  const d1 = aggregateToD1(h1Bars)
  if (d1.length < 2) return { pdHigh: px, pdLow: px, weekHigh: px, weekLow: px, d1Bias: "NEUTRAL", d1OBs: [] }

  const prev     = d1[d1.length - 2]  // previous complete day
  const recent5  = d1.slice(-5)
  const weekHigh = Math.max(...recent5.map(b => b.high))
  const weekLow  = Math.min(...recent5.map(b => b.low))

  let d1Bias: "UP" | "DOWN" | "NEUTRAL" = "NEUTRAL"
  if (d1.length >= 3) {
    const [a, b, c] = d1.slice(-3)
    if (c.close > b.close && b.close > a.close) d1Bias = "UP"
    else if (c.close < b.close && b.close < a.close) d1Bias = "DOWN"
  }

  return {
    pdHigh:  prev.high,
    pdLow:   prev.low,
    weekHigh, weekLow, d1Bias,
    d1OBs:   detectOrderBlocks(d1, px).slice(0, 2),
  }
}

// ── Main entry point ───────────────────────────────────────────

export function buildSMCContext(bars: OHLCBar[], px: number, h4Bars?: OHLCBar[]): SMCContext {
  return {
    structure:     analyzeStructure(bars, px),
    orderBlocks:   detectOrderBlocks(bars, px),
    h4OrderBlocks: detectH4OrderBlocks(bars, px, h4Bars),
    fvgs:          detectFVGs(bars, px),
    liquidity:     detectLiquidity(bars, px),
    sweeps:        detectLiquiditySweeps(bars),
    divergence:    detectRSIDivergence(bars),
    daily:         buildDailyContext(bars, px),
  }
}

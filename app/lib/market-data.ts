import type { Pair, OHLCBar, Signal, KnowledgeModule, Session, HistoryEntry } from "./types"

export const PAIRS_SEED: Omit<Pair, "id" | "active" | "status" | "signal" | "lastScan" | "history" | "reasoning" | "confidence" | "rsi" | "macd">[] = [
  { sym: "EUR/USD", name: "Euro / US Dollar",       group: "FX Major", px: 1.0891, digits: 5, spread: 0.6, vol: 0.00035 },
  { sym: "GBP/USD", name: "Pound / US Dollar",      group: "FX Major", px: 1.2643, digits: 5, spread: 0.9, vol: 0.00045 },
  { sym: "USD/JPY", name: "US Dollar / Yen",        group: "FX Major", px: 156.42, digits: 3, spread: 0.8, vol: 0.04 },
  { sym: "AUD/USD", name: "Aussie / US Dollar",     group: "FX Major", px: 0.6587, digits: 5, spread: 0.7, vol: 0.00028 },
  { sym: "USD/CAD", name: "US Dollar / Loonie",     group: "FX Major", px: 1.3712, digits: 5, spread: 0.8, vol: 0.00033 },
  { sym: "USD/CHF", name: "US Dollar / Swiss Franc",group: "FX Major", px: 0.9054, digits: 5, spread: 0.9, vol: 0.00030 },
  { sym: "NZD/USD", name: "Kiwi / US Dollar",       group: "FX Major", px: 0.5982, digits: 5, spread: 1.0, vol: 0.00029 },
  { sym: "XAU/USD", name: "Gold Spot",              group: "Metals",   px: 2342.18, digits: 2, spread: 0.18, vol: 0.45 },
  { sym: "XAG/USD", name: "Silver Spot",            group: "Metals",   px: 30.42, digits: 3, spread: 0.022, vol: 0.018 },
  { sym: "BTC/USD", name: "Bitcoin",                group: "Crypto",   px: 67342.5, digits: 1, spread: 4.5, vol: 25 },
  { sym: "ETH/USD", name: "Ethereum",               group: "Crypto",   px: 3128.7, digits: 2, spread: 1.2, vol: 4.5 },
  { sym: "US100",   name: "Nasdaq 100",             group: "Index",    px: 18432.5, digits: 1, spread: 1.0, vol: 6.0 },
  { sym: "US30",    name: "Dow Jones 30",           group: "Index",    px: 39872.1, digits: 1, spread: 1.5, vol: 8.0 },
  { sym: "WTI",     name: "Crude Oil WTI",          group: "Energy",   px: 78.34, digits: 2, spread: 0.03, vol: 0.06 },
]

export const SKILLSETS = [
  "Trend Following",
  "Breakout Hunter",
  "Scalping Mode",
  "Smart Money Concepts",
  "Price Action",
  "Multi-Strategy",
]

export const KNOWLEDGE: KnowledgeModule[] = [
  { key: "snr",  label: "Support & Resistance", on: true  },
  { key: "ms",   label: "Market Structure",      on: true  },
  { key: "liq",  label: "Liquidity Zones",       on: true  },
  { key: "sess", label: "Session Analysis",      on: true  },
  { key: "news", label: "News Filter",           on: true  },
  { key: "corr", label: "Correlation Matrix",    on: true  },
  { key: "ew",   label: "Elliott Wave",          on: false },
  { key: "of",   label: "Order Flow",            on: false },
  { key: "fib",  label: "Fibonacci Confluence",  on: false },
  { key: "vol",  label: "Volume Profile",        on: false },
]

const REASONING_NO_TRADE = [
  "{sym} consolidating inside {h}/{l} range. Compression building, awaiting directional break.",
  "{sym} showing mixed structure on H1. No clean liquidity sweep yet, monitoring for displacement.",
  "{sym} sitting at mid-range. Insufficient confluence — waiting for session open to confirm bias.",
  "{sym} respecting {h} resistance for now. No bearish BOS confirmed, no entry.",
  "{sym} chopping under {h}. Order flow neutral, RSI flat, no edge.",
]


export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function fmt(px: number, digits: number): string {
  return px.toFixed(digits)
}

// ── Technical Indicator Calculations ───────────────────────────

export function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = []
  let e = values[0] ?? 0
  for (const v of values) {
    e = v * k + e * (1 - k)
    ema.push(e)
  }
  return ema
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let ag = gains / period, al = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    ag = (ag * (period - 1) + g) / period
    al = (al * (period - 1) + l) / period
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al)
}

export function calcMACD(closes: number[]): { macdLine: number; signalLine: number; histogram: number } {
  if (closes.length < 26) return { macdLine: 0, signalLine: 0, histogram: 0 }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdSeries = ema12.map((v, i) => v - ema26[i])
  const signalSeries = calcEMA(macdSeries, 9)
  const last = macdSeries.length - 1
  const macdLine = macdSeries[last]
  const signalLine = signalSeries[last]
  return { macdLine, signalLine, histogram: macdLine - signalLine }
}

export function calcBB(closes: number[], period = 20, mult = 2): { upper: number; mid: number; lower: number } {
  const recent = closes.slice(-period)
  if (recent.length < 2) return { upper: closes[0] ?? 0, mid: closes[0] ?? 0, lower: closes[0] ?? 0 }
  const mid = recent.reduce((s, v) => s + v, 0) / recent.length
  const std = Math.sqrt(recent.reduce((s, v) => s + (v - mid) ** 2, 0) / recent.length)
  return { upper: mid + mult * std, mid, lower: mid - mult * std }
}

export function calcTrend(closes: number[]): "UP" | "DOWN" | "NEUTRAL" {
  if (closes.length < 50) return "NEUTRAL"
  const ema20 = calcEMA(closes, 20)
  const ema50 = calcEMA(closes, 50)
  const diff = ema20[ema20.length - 1] - ema50[ema50.length - 1]
  const threshold = closes[closes.length - 1] * 0.0002
  if (diff > threshold) return "UP"
  if (diff < -threshold) return "DOWN"
  return "NEUTRAL"
}

export interface SwingLevels { support: number[]; resistance: number[] }

export function calcSwingLevels(bars: OHLCBar[], lookback = 5): SwingLevels {
  const support: number[] = []
  const resistance: number[] = []
  for (let i = lookback; i < bars.length - lookback; i++) {
    const isSwingHigh = bars.slice(i - lookback, i).every(b => b.high <= bars[i].high) &&
                        bars.slice(i + 1, i + lookback + 1).every(b => b.high <= bars[i].high)
    const isSwingLow  = bars.slice(i - lookback, i).every(b => b.low >= bars[i].low) &&
                        bars.slice(i + 1, i + lookback + 1).every(b => b.low >= bars[i].low)
    if (isSwingHigh) resistance.push(bars[i].high)
    if (isSwingLow)  support.push(bars[i].low)
  }
  const px = bars[bars.length - 1]?.close ?? 0
  return {
    support:    support.filter(l => l < px).sort((a, b) => b - a).slice(0, 4),
    resistance: resistance.filter(l => l > px).sort((a, b) => a - b).slice(0, 4),
  }
}

export interface MarketContext {
  rsi: number
  macdLine: number
  signalLine: number
  histogram: number
  bb: { upper: number; mid: number; lower: number }
  trend: "UP" | "DOWN" | "NEUTRAL"
  swings: SwingLevels
  activeSessions: string[]
  atr: number
  candlePatterns: CandlePattern[]
  htf: HigherTFContext
}

// ── ATR (Wilder's) ─────────────────────────────────────────────

export function calcATR(bars: OHLCBar[], period = 14): number {
  if (bars.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close),
    ))
  }
  if (trs.length < period) return trs.reduce((s, v) => s + v, 0) / trs.length
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
  return atr
}

// ── Candle Pattern Detection ───────────────────────────────────

export interface CandlePattern {
  name: string
  type: "bullish" | "bearish" | "neutral"
  strength: 1 | 2 | 3
}

export function detectCandlePatterns(bars: OHLCBar[]): CandlePattern[] {
  if (bars.length < 3) return []
  const patterns: CandlePattern[] = []
  const c  = bars[bars.length - 1]
  const p1 = bars[bars.length - 2]
  const p2 = bars[bars.length - 3]

  const cBody  = Math.abs(c.close  - c.open)
  const cRange = c.high - c.low
  const p1Body = Math.abs(p1.close - p1.open)

  const upperWick  = c.high - Math.max(c.open, c.close)
  const lowerWick  = Math.min(c.open, c.close) - c.low

  // Bullish Engulfing
  if (p1.close < p1.open && c.close > c.open &&
      c.open <= p1.close && c.close >= p1.open && cBody > p1Body * 0.9)
    patterns.push({ name: "Bullish Engulfing", type: "bullish", strength: 3 })

  // Bearish Engulfing
  if (p1.close > p1.open && c.close < c.open &&
      c.open >= p1.close && c.close <= p1.open && cBody > p1Body * 0.9)
    patterns.push({ name: "Bearish Engulfing", type: "bearish", strength: 3 })

  // Bullish Pin Bar / Hammer
  if (cRange > 0 && lowerWick > cRange * 0.55 && upperWick < cRange * 0.25)
    patterns.push({ name: c.close > c.open ? "Hammer" : "Bullish Pin Bar", type: "bullish", strength: 2 })

  // Bearish Pin Bar / Shooting Star
  if (cRange > 0 && upperWick > cRange * 0.55 && lowerWick < cRange * 0.25)
    patterns.push({ name: c.close < c.open ? "Shooting Star" : "Bearish Pin Bar", type: "bearish", strength: 2 })

  // Doji
  if (cRange > 0 && cBody / cRange < 0.08)
    patterns.push({ name: "Doji", type: "neutral", strength: 1 })

  // Inside Bar (compression)
  if (c.high <= p1.high && c.low >= p1.low)
    patterns.push({ name: "Inside Bar", type: "neutral", strength: 1 })

  // Three White Soldiers
  if (c.close > c.open && p1.close > p1.open && p2.close > p2.open &&
      c.close > p1.close && p1.close > p2.close &&
      c.open > p1.open && p1.open > p2.open)
    patterns.push({ name: "Three White Soldiers", type: "bullish", strength: 3 })

  // Three Black Crows
  if (c.close < c.open && p1.close < p1.open && p2.close < p2.open &&
      c.close < p1.close && p1.close < p2.close &&
      c.open < p1.open && p1.open < p2.open)
    patterns.push({ name: "Three Black Crows", type: "bearish", strength: 3 })

  // Morning Star (3-bar bullish reversal)
  const p2Body = Math.abs(p2.close - p2.open)
  if (p2.close < p2.open && Math.abs(p1.close - p1.open) < p2Body * 0.4 &&
      c.close > c.open && c.close > (p2.open + p2.close) / 2)
    patterns.push({ name: "Morning Star", type: "bullish", strength: 3 })

  // Evening Star
  if (p2.close > p2.open && Math.abs(p1.close - p1.open) < p2Body * 0.4 &&
      c.close < c.open && c.close < (p2.open + p2.close) / 2)
    patterns.push({ name: "Evening Star", type: "bearish", strength: 3 })

  return patterns
}

// ── Higher Timeframe Context (H4 from H1 bars) ────────────────

export interface HigherTFContext {
  trend: "UP" | "DOWN" | "NEUTRAL"
  rsi: number
  support: number[]
  resistance: number[]
  lastClose: number
  lastBarBullish: boolean
}

export function buildHigherTFContext(h1Bars: OHLCBar[]): HigherTFContext {
  // Aggregate H1 → H4 (group every 4 bars)
  const h4: OHLCBar[] = []
  for (let i = 0; i + 3 < h1Bars.length; i += 4) {
    const chunk = h1Bars.slice(i, i + 4)
    h4.push({
      time:   chunk[0].time,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(b => b.high)),
      low:    Math.min(...chunk.map(b => b.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + (b.volume ?? 0), 0),
    })
  }
  if (h4.length < 5) return { trend: "NEUTRAL", rsi: 50, support: [], resistance: [], lastClose: 0, lastBarBullish: true }

  const closes = h4.map(b => b.close)
  const last   = h4[h4.length - 1]
  const swings = calcSwingLevels(h4)
  return {
    trend:          calcTrend(closes),
    rsi:            calcRSI(closes),
    support:        swings.support.slice(0, 3),
    resistance:     swings.resistance.slice(0, 3),
    lastClose:      last.close,
    lastBarBullish: last.close >= last.open,
  }
}

export function buildMarketContext(p: Pair): MarketContext {
  const closes = p.history.map(b => b.close)
  const rsi  = calcRSI(closes)
  const { macdLine, signalLine, histogram } = calcMACD(closes)
  const bb     = calcBB(closes)
  const trend  = calcTrend(closes)
  const swings = calcSwingLevels(p.history)
  const sessions = activeSessions().filter(s => s.active).map(s => s.label)
  const atr    = calcATR(p.history)
  const candlePatterns = detectCandlePatterns(p.history.slice(-5))
  const htf    = buildHigherTFContext(p.history)
  return { rsi, macdLine, signalLine, histogram, bb, trend, swings, activeSessions: sessions, atr, candlePatterns, htf }
}

function seedHistory(px: number, vol: number, n = 220): OHLCBar[] {
  const out: OHLCBar[] = []
  const now = Math.floor(Date.now() / 1000)
  let last = px
  for (let i = n - 1; i >= 0; i--) {
    const t = now - i * 60
    const drift = (Math.random() - 0.5) * vol * 0.6
    const open = last
    const close = last + drift
    const high = Math.max(open, close) + Math.random() * vol * 0.5
    const low  = Math.min(open, close) - Math.random() * vol * 0.5
    out.push({ time: t, open, high, low, close, volume: Math.random() * 1000 + 200 })
    last = close
  }
  return out
}

export function buildInitialState(): Pair[] {
  return PAIRS_SEED.map((p, i) => {
    const history = seedHistory(p.px, p.vol)
    const closes = history.map(b => b.close)
    const rsi = calcRSI(closes)
    const { macdLine } = calcMACD(closes)
    return {
      id: i,
      ...p,
      active: i < 8,
      status: "NO TRADE" as const,
      signal: null,
      lastScan: Date.now() - Math.floor(Math.random() * 240000),
      history,
      reasoning: pick(REASONING_NO_TRADE)
        .replace("{sym}", p.sym)
        .replace("{h}", fmt(p.px + p.vol * 3, p.digits))
        .replace("{l}", fmt(p.px - p.vol * 3, p.digits))
        .replace("{entry}", fmt(p.px, p.digits)),
      confidence: Math.floor(15 + Math.random() * 50),
      rsi,
      macd: macdLine,
    }
  })
}

export function tickPair(p: Pair): Pair {
  const drift = (Math.random() - 0.499) * p.vol * 0.4
  const newPx = Math.max(p.px * 0.8, p.px + drift)
  const last = p.history[p.history.length - 1]
  const now = Math.floor(Date.now() / 1000)
  const updHistory = last && now - last.time < 60
    ? [...p.history.slice(0, -1), {
        ...last,
        close: newPx,
        high: Math.max(last.high, newPx),
        low: Math.min(last.low, newPx),
      }]
    : [...p.history.slice(-219), {
        time: now,
        open: p.px,
        high: Math.max(p.px, newPx),
        low: Math.min(p.px, newPx),
        close: newPx,
        volume: Math.random() * 1000 + 200,
      }]
  return { ...p, px: newPx, history: updHistory }
}

export function makeSignal(p: Pair, skillset: string): Signal {
  const ctx = buildMarketContext(p)
  const { rsi, macdLine, signalLine, histogram, bb, trend, swings, atr, candlePatterns, htf } = ctx

  let bullScore = 0, bearScore = 0
  const bullReasons: string[] = []
  const bearReasons: string[] = []

  // ── H4 Trend (highest weight — trade WITH the higher TF) ─────
  if (htf.trend === "UP")   { bullScore += 3; bullReasons.push(`H4 uptrend (RSI ${htf.rsi.toFixed(0)})`) }
  if (htf.trend === "DOWN") { bearScore += 3; bearReasons.push(`H4 downtrend (RSI ${htf.rsi.toFixed(0)})`) }
  // H4 RSI extremes add extra weight
  if (htf.rsi < 35) { bullScore += 2; bullReasons.push(`H4 RSI oversold (${htf.rsi.toFixed(0)})`) }
  if (htf.rsi > 65) { bearScore += 2; bearReasons.push(`H4 RSI overbought (${htf.rsi.toFixed(0)})`) }

  // H4 key levels
  const htfProx = p.px * 0.004
  if (htf.support.length > 0 && Math.abs(p.px - htf.support[0]) < htfProx) {
    bullScore += 2; bullReasons.push(`H4 support at ${fmt(htf.support[0], p.digits)}`)
  }
  if (htf.resistance.length > 0 && Math.abs(p.px - htf.resistance[0]) < htfProx) {
    bearScore += 2; bearReasons.push(`H4 resistance at ${fmt(htf.resistance[0], p.digits)}`)
  }

  // ── H1 Indicators ────────────────────────────────────────────
  if (rsi < 32) { bullScore += 2; bullReasons.push(`H1 RSI oversold (${rsi.toFixed(1)})`) }
  else if (rsi < 42) { bullScore += 1 }
  if (rsi > 68) { bearScore += 2; bearReasons.push(`H1 RSI overbought (${rsi.toFixed(1)})`) }
  else if (rsi > 58) { bearScore += 1 }

  if (macdLine > signalLine && histogram > 0) { bullScore += 2; bullReasons.push("MACD bullish crossover") }
  else if (macdLine > 0) { bullScore += 1 }
  if (macdLine < signalLine && histogram < 0) { bearScore += 2; bearReasons.push("MACD bearish crossover") }
  else if (macdLine < 0) { bearScore += 1 }

  if (trend === "UP")   { bullScore += 2; bullReasons.push("H1 EMA uptrend") }
  if (trend === "DOWN") { bearScore += 2; bearReasons.push("H1 EMA downtrend") }

  const bbWidth = bb.upper - bb.lower
  if (bbWidth > 0) {
    const pos = (p.px - bb.lower) / bbWidth
    if (pos < 0.15) { bullScore += 2; bullReasons.push(`Price at lower BB ${fmt(bb.lower, p.digits)}`) }
    else if (pos < 0.30) { bullScore += 1 }
    if (pos > 0.85) { bearScore += 2; bearReasons.push(`Price at upper BB ${fmt(bb.upper, p.digits)}`) }
    else if (pos > 0.70) { bearScore += 1 }
  }

  // H1 Key levels
  const prox = p.px * 0.0025
  if (swings.support[0] && Math.abs(p.px - swings.support[0]) < prox) {
    bullScore += 2; bullReasons.push(`H1 support ${fmt(swings.support[0], p.digits)}`)
  }
  if (swings.resistance[0] && Math.abs(p.px - swings.resistance[0]) < prox) {
    bearScore += 2; bearReasons.push(`H1 resistance ${fmt(swings.resistance[0], p.digits)}`)
  }

  // ── Candle Pattern Confirmation ───────────────────────────────
  for (const cp of candlePatterns) {
    if (cp.type === "bullish") { bullScore += cp.strength; bullReasons.push(cp.name) }
    if (cp.type === "bearish") { bearScore += cp.strength; bearReasons.push(cp.name) }
  }

  // Session liquidity boost
  if (ctx.activeSessions.length >= 2) { bullScore += 1; bearScore += 1 }

  // ── Hard filter: contra-H4 trend kills the signal ────────────
  const side: "BUY" | "SELL" = bullScore >= bearScore ? "BUY" : "SELL"
  const contraTrend = (side === "BUY" && htf.trend === "DOWN") || (side === "SELL" && htf.trend === "UP")
  const maxScore = Math.max(bullScore, bearScore)

  // Require score ≥ 4, and if contra-H4 trend require score ≥ 8
  const minRequired = contraTrend ? 8 : 4
  if (maxScore < minRequired) {
    return {
      side: "BUY", entry: p.px, sl: p.px - atr * 1.5, tp1: p.px + atr * 2, tp2: p.px + atr * 3,
      confidence: 20, rr: "2.00", tf: "H1", skillset,
      why: `${p.sym} no trade — score ${maxScore}/${minRequired} required${contraTrend ? " (contra H4 trend)" : ""}.`,
      time: Date.now(),
    }
  }

  const reasons = side === "BUY" ? bullReasons : bearReasons

  // ── ATR-based position sizing ─────────────────────────────────
  // SL: 1.5×ATR beyond entry (tighter when score high)
  const slAtrMult = maxScore >= 10 ? 1.2 : maxScore >= 7 ? 1.5 : 2.0
  const rrNum = contraTrend ? 2.5 + Math.random() * 0.5 : 1.8 + Math.random() * 1.4
  const slDist = atr * slAtrMult
  const tpDist = slDist * rrNum
  const entry = p.px
  const sl  = side === "BUY" ? entry - slDist : entry + slDist
  const tp1 = side === "BUY" ? entry + tpDist * 0.55 : entry - tpDist * 0.55
  const tp2 = side === "BUY" ? entry + tpDist : entry - tpDist

  // Confidence caps at 94; contra-H4 capped at 75
  const rawConf = Math.floor(50 + maxScore * 3.5 + Math.random() * 5)
  const confidence = Math.min(contraTrend ? 75 : 94, rawConf)

  const sessionStr = ctx.activeSessions.length > 0 ? ctx.activeSessions.join("/") + " session" : "off-session"
  const patternStr = candlePatterns.filter(cp => cp.type !== "neutral").map(cp => cp.name).join(", ")
  const topReasons = reasons.slice(0, 3).join(" + ")
  const why = `${p.sym} ${side} — ${topReasons}${patternStr ? ` + ${patternStr}` : ""}. ATR-based SL at ${fmt(sl, p.digits)}, target ${fmt(tp2, p.digits)} (1:${rrNum.toFixed(1)}). ${sessionStr}.`

  return { side, entry, sl, tp1, tp2, confidence, rr: rrNum.toFixed(2), tf: "H1", skillset, why, time: Date.now() }
}

export function activeSessions(): Session[] {
  const h = new Date().getUTCHours()
  return [
    { key: "tokyo",  label: "Tokyo",  start: 23, end: 8,  active: h >= 23 || h < 8 },
    { key: "london", label: "London", start: 8,  end: 17, active: h >= 8 && h < 17 },
    { key: "ny",     label: "New York", start: 13, end: 22, active: h >= 13 && h < 22 },
    { key: "sydney", label: "Sydney", start: 21, end: 6,  active: h >= 21 || h < 6 },
  ]
}

export function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export interface CorrelationRow { sym: string; row: number[] }

export function buildCorrelationMatrix(pairs: Pair[]): CorrelationRow[] {
  const active = pairs.filter(p => p.active).slice(0, 8)
  return active.map((a, i) => {
    const row = active.map((b, j) => {
      if (i === j) return 1
      // Use last 30 close prices to compute Pearson correlation
      const aClose = a.history.slice(-30).map(h => h.close)
      const bClose = b.history.slice(-30).map(h => h.close)
      const len = Math.min(aClose.length, bClose.length)
      if (len < 3) return 0
      const ax = aClose.slice(-len), bx = bClose.slice(-len)
      const am = ax.reduce((s, v) => s + v, 0) / len
      const bm = bx.reduce((s, v) => s + v, 0) / len
      let num = 0, da = 0, db = 0
      for (let k = 0; k < len; k++) {
        const ad = ax[k] - am, bd = bx[k] - bm
        num += ad * bd
        da += ad * ad
        db += bd * bd
      }
      const denom = Math.sqrt(da * db)
      return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom))
    })
    return { sym: a.sym, row }
  })
}

export interface PerfRow { key: string; total: number; wins: number; losses: number; winRate: number; totalR: number }
export interface PerfData {
  total: number; wins: number; losses: number
  winRate: number; totalR: number; profitFactor: number
  expectancy: number; avgWin: number; avgLoss: number
  equity: { r: number }[]
  bySkillset: PerfRow[]; bySymbol: PerfRow[]
}

export function aggregatePerformance(history: HistoryEntry[]): PerfData {
  const closed = history.filter(h => h.pnl_r != null)
  if (!closed.length) return {
    total:0, wins:0, losses:0, winRate:0, totalR:0,
    profitFactor:0, expectancy:0, avgWin:0, avgLoss:0,
    equity:[], bySkillset:[], bySymbol:[],
  }
  const wins   = closed.filter(h => (h.pnl_r ?? 0) > 0)
  const losses = closed.filter(h => (h.pnl_r ?? 0) < 0)
  const totalR = closed.reduce((s, h) => s + (h.pnl_r ?? 0), 0)
  const grossW = wins.reduce((s, h) => s + (h.pnl_r ?? 0), 0)
  const grossL = Math.abs(losses.reduce((s, h) => s + (h.pnl_r ?? 0), 0))
  const avgWin  = wins.length   ? grossW / wins.length   : 0
  const avgLoss = losses.length ? grossL / losses.length : 0
  const winRate = closed.length ? wins.length / closed.length : 0

  // running equity
  let running = 0
  const equity = closed.map(h => { running += h.pnl_r ?? 0; return { r: running } })

  // group by skillset
  const skillMap = new Map<string, PerfRow>()
  const symMap   = new Map<string, PerfRow>()
  for (const h of closed) {
    for (const [key, map] of [[h.skillset, skillMap], [h.sym, symMap]] as const) {
      if (!map.has(key)) map.set(key, { key, total:0, wins:0, losses:0, winRate:0, totalR:0 })
      const r = map.get(key)!
      r.total++
      r.totalR += h.pnl_r ?? 0
      if ((h.pnl_r ?? 0) > 0) { r.wins++ } else { r.losses++ }
      r.winRate = r.wins / r.total
    }
  }

  return {
    total: closed.length, wins: wins.length, losses: losses.length,
    winRate, totalR,
    profitFactor: grossL > 0 ? grossW / grossL : grossW > 0 ? 999 : 0,
    expectancy: winRate * avgWin - (1 - winRate) * avgLoss,
    avgWin, avgLoss, equity,
    bySkillset: Array.from(skillMap.values()).sort((a,b) => b.total - a.total),
    bySymbol:   Array.from(symMap.values()).sort((a,b) => b.total - a.total),
  }
}

export function generateHistory(pairs: Pair[], days = 14): HistoryEntry[] {
  const out: HistoryEntry[] = []
  const now = Date.now()
  const skillsets = SKILLSETS
  let id = 1
  for (let d = days; d >= 0; d--) {
    const count = 3 + Math.floor(Math.random() * 5)
    for (let i = 0; i < count; i++) {
      const p = pairs[Math.floor(Math.random() * pairs.length)]
      const side = Math.random() > 0.5 ? "BUY" : "SELL"
      const slDist = p.vol * (2 + Math.random() * 3)
      const rrNum = 1.5 + Math.random() * 2.5
      const entry = p.px * (1 + (Math.random() - 0.5) * 0.002)
      const sl    = side === "BUY" ? entry - slDist : entry + slDist
      const tp1   = side === "BUY" ? entry + slDist * rrNum * 0.6 : entry - slDist * rrNum * 0.6
      const tp2   = side === "BUY" ? entry + slDist * rrNum : entry - slDist * rrNum
      const won   = Math.random() < 0.58
      const pnl_r = won ? rrNum * (0.6 + Math.random() * 0.8) : -(0.6 + Math.random() * 0.4)
      const state = won ? (Math.random() > 0.4 ? "TP2" : "TP1") : "SL"
      out.push({
        id: id++,
        sym: p.sym, digits: p.digits,
        side, confidence: Math.floor(60 + Math.random() * 35),
        entry, sl, tp1, tp2,
        rr: rrNum.toFixed(2), tf: "H1",
        skillset: skillsets[Math.floor(Math.random() * skillsets.length)],
        why: `${p.sym} ${side} signal — ${won ? "target reached" : "stopped out"}.`,
        time: now - d * 86400000 - Math.random() * 86400000,
        state, pnl_r,
      })
    }
  }
  return out.sort((a, b) => b.time - a.time)
}

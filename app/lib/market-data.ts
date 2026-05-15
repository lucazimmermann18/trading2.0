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

const REASONING_TRADE = [
  "{sym} swept liquidity above {h} then printed bearish BOS at {entry}. Retest of breaker active — sell on confirmation.",
  "{sym} bullish FVG at {entry} aligned with London open momentum. SMC + session confluence.",
  "{sym} range expansion off {l} support with rising RSI divergence. Breakout long active.",
  "{sym} broke {h} with volume spike. Pullback to OB at {entry} expected — high-prob long.",
  "{sym} M5 micro-structure shifted, mitigated demand at {entry}. Scalp long with tight invalidation.",
]

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function fmt(px: number, digits: number): string {
  return px.toFixed(digits)
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
  return PAIRS_SEED.map((p, i) => ({
    id: i,
    ...p,
    active: i < 8,
    status: "NO TRADE" as const,
    signal: null,
    lastScan: Date.now() - Math.floor(Math.random() * 240000),
    history: seedHistory(p.px, p.vol),
    reasoning: pick(REASONING_NO_TRADE)
      .replace("{sym}", p.sym)
      .replace("{h}", fmt(p.px + p.vol * 3, p.digits))
      .replace("{l}", fmt(p.px - p.vol * 3, p.digits))
      .replace("{entry}", fmt(p.px, p.digits)),
    confidence: Math.floor(15 + Math.random() * 50),
    rsi: 30 + Math.random() * 40,
    macd: (Math.random() - 0.5) * 0.5,
  }))
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
  const side = Math.random() > 0.5 ? "BUY" : "SELL"
  const confidence = Math.floor(60 + Math.random() * 35)
  const rrNum = 1.5 + Math.random() * 2.5
  const slDist = p.vol * (2 + Math.random() * 3)
  const tpDist = slDist * rrNum
  const entry = p.px
  const sl   = side === "BUY" ? entry - slDist : entry + slDist
  const tp1  = side === "BUY" ? entry + tpDist * 0.6 : entry - tpDist * 0.6
  const tp2  = side === "BUY" ? entry + tpDist : entry - tpDist
  const why  = pick(REASONING_TRADE)
    .replace("{sym}", p.sym)
    .replace("{h}", fmt(p.px + p.vol * 3, p.digits))
    .replace("{l}", fmt(p.px - p.vol * 3, p.digits))
    .replace("{entry}", fmt(entry, p.digits))
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

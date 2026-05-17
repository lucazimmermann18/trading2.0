export interface WatchZone {
  id: string
  direction: "BUY" | "SELL"
  zoneTop: number
  zoneBottom: number
  activateAt: number     // price level that triggers tactical mode
  reason: string
  invalidateIf: string
  createdAt: number
  expiresAt: number
}

export interface Pair {
  id: number
  sym: string
  name: string
  group: string
  px: number
  digits: number
  spread: number
  vol: number
  active: boolean
  status: "TRADE" | "NO TRADE"
  signal: Signal | null
  lastScan: number
  history: OHLCBar[]
  h4History?: OHLCBar[]
  reasoning: string
  confidence: number
  rsi: number
  macd: number
  watchZones?: WatchZone[]
  scanPhase?: "idle" | "watching" | "tactical"
}

export interface OHLCBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ConfluenceItem {
  label: string
  met: boolean
  detail?: string
}

export interface Signal {
  side: "BUY" | "SELL"
  entry: number
  sl: number
  tp1: number
  tp2: number
  confidence: number
  rr: string
  tf: string
  skillset: string
  why: string
  time: number
  expiresAt: number
  confluences?: ConfluenceItem[]
}

export interface HistoryEntry {
  id?: number
  sym: string
  digits: number
  side: "BUY" | "SELL"
  entry: number
  sl: number
  tp1: number
  tp2: number
  confidence: number
  rr: string
  tf: string
  skillset: string
  why: string
  time: number
  expiresAt?: number
  confluences?: ConfluenceItem[]
  state: "ACTIVE" | "CLOSED" | "CANCELLED" | "TP1" | "TP2" | "SL" | "EXPIRED"
  pnl_r?: number
  notes?: string
}


export interface Session {
  key: string
  label: string
  start: number
  end: number
  active: boolean
}

export type ViewId = "dashboard" | "multichart" | "heatmap" | "performance" | "journal" | "replay" | "system" | "mtf" | "intermarket"
export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1"

export type AuditKind = "scan" | "signal" | "zone" | "tp" | "sl" | "config" | "ai" | "feed"

export interface AuditEntry {
  id: number
  time: number
  kind: AuditKind
  msg: string
}

export interface SystemMetrics {
  scanCount: number
  signalCount: number
  tpCount: number
  slCount: number
  lastAILatency: number
}

export interface EconomicEvent {
  date: string
  time: string
  country: string
  currency: string
  impact: "high" | "medium" | "low"
  event: string
  actual?: string
  forecast?: string
  previous?: string
}

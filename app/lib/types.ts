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
  reasoning: string
  confidence: number
  rsi: number
  macd: number
}

export interface OHLCBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
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
  state: "ACTIVE" | "CLOSED" | "CANCELLED" | "TP1" | "TP2" | "SL"
  pnl_r?: number
  notes?: string
}

export interface KnowledgeModule {
  key: string
  label: string
  on: boolean
}

export interface Session {
  key: string
  label: string
  start: number
  end: number
  active: boolean
}

export type ViewId = "dashboard" | "multichart" | "heatmap" | "performance" | "journal" | "replay" | "system"
export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1"

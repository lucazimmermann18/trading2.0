import type { OHLCBar } from "./types"

const API_KEY = "36d7c96edf3c44a4a50a69a03dde49cc"
const BASE = "https://api.twelvedata.com"

const TD_SYMBOL_MAP: Record<string, string> = {
  "US100": "NDX",
  "US30":  "DJI",
  "WTI":   "WTI/USD",
}

async function tdFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set("apikey", API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as T & { status?: string; message?: string }
  if ((data as { status?: string }).status === "error") throw new Error((data as { message?: string }).message ?? "API error")
  return data
}

function mapSymbol(sym: string): string {
  return TD_SYMBOL_MAP[sym] ?? sym
}

const TF_MAP: Record<string, string> = {
  M1: "1min", M5: "5min", M15: "15min", H1: "1h", H4: "4h", D1: "1day",
}

export async function fetchBars(sym: string, tf: string, outputsize = 150): Promise<OHLCBar[]> {
  const interval = TF_MAP[tf] ?? tf
  const symbol = mapSymbol(sym)

  type TDResp = { values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[] }
  const data = await tdFetch<TDResp>("time_series", { symbol, interval, outputsize: String(outputsize) })
  if (!data.values?.length) return []

  return data.values.reverse().map(v => ({
    time: Math.floor(new Date(v.datetime).getTime() / 1000),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low:  parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume ?? "0"),
  }))
}

export async function fetchPrice(sym: string): Promise<{ price: number; change: number; changePct: number } | null> {
  const symbol = mapSymbol(sym)
  type QResp = { close?: string; change?: string; percent_change?: string; status?: string }
  try {
    const data = await tdFetch<QResp>("quote", { symbol })
    return {
      price: parseFloat(data.close ?? "0"),
      change: parseFloat(data.change ?? "0"),
      changePct: parseFloat(data.percent_change ?? "0"),
    }
  } catch {
    return null
  }
}

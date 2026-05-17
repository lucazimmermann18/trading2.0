import type { OHLCBar } from "./types"

const CACHE_KEY = "tradeai_h1_v2"
const TTL_MS = 4 * 60 * 60 * 1000
const REFRESH_MS = 60 * 60 * 1000

interface Slot { bars: OHLCBar[]; savedAt: number }
type Store = Record<string, Slot>

function read(): Store {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") } catch { return {} }
}
function write(store: Store) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)) } catch {}
}

export function getCachedBars(sym: string): OHLCBar[] | null {
  const slot = read()[sym]
  if (!slot || Date.now() - slot.savedAt > TTL_MS) return null
  return slot.bars
}
export function isCacheStale(sym: string): boolean {
  const slot = read()[sym]
  if (!slot) return false
  return Date.now() - slot.savedAt > REFRESH_MS
}
export function getCacheAgeMinutes(sym: string): number | null {
  const slot = read()[sym]
  return slot ? Math.floor((Date.now() - slot.savedAt) / 60_000) : null
}
export function setCachedBars(sym: string, bars: OHLCBar[]) {
  const store = read()
  store[sym] = { bars, savedAt: Date.now() }
  write(store)
}
export function getCachedBarsAnyAge(sym: string): OHLCBar[] | null {
  return read()[sym]?.bars ?? null
}

// ── H4 bar cache (8h TTL) ─────────────────────────────────────

const H4_CACHE_KEY = "tradeai_h4_v1"
const H4_TTL_MS   = 8 * 60 * 60 * 1000

function readH4(): Store {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(H4_CACHE_KEY) ?? "{}") } catch { return {} }
}
function writeH4(store: Store) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(H4_CACHE_KEY, JSON.stringify(store)) } catch {}
}

export function getCachedH4Bars(sym: string): OHLCBar[] | null {
  const slot = readH4()[sym]
  if (!slot || Date.now() - slot.savedAt > H4_TTL_MS) return null
  return slot.bars
}
export function getCachedH4BarsAnyAge(sym: string): OHLCBar[] | null {
  return readH4()[sym]?.bars ?? null
}
export function setCachedH4Bars(sym: string, bars: OHLCBar[]) {
  const store = readH4()
  store[sym] = { bars, savedAt: Date.now() }
  writeH4(store)
}

// ── D1 bar cache (24h TTL) ─────────────────────────────────────

const D1_CACHE_KEY = "tradeai_d1_v1"
const D1_TTL_MS   = 24 * 60 * 60 * 1000

function readD1(): Store {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(D1_CACHE_KEY) ?? "{}") } catch { return {} }
}
function writeD1(store: Store) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(D1_CACHE_KEY, JSON.stringify(store)) } catch {}
}

export function getCachedD1Bars(sym: string): OHLCBar[] | null {
  const slot = readD1()[sym]
  if (!slot || Date.now() - slot.savedAt > D1_TTL_MS) return null
  return slot.bars
}
export function getCachedD1BarsAnyAge(sym: string): OHLCBar[] | null {
  return readD1()[sym]?.bars ?? null
}
export function setCachedD1Bars(sym: string, bars: OHLCBar[]) {
  const store = readD1()
  store[sym] = { bars, savedAt: Date.now() }
  writeD1(store)
}

import type { OHLCBar } from "./types"

const CACHE_KEY = "tradeai_h1_v2"
const TTL_MS = 4 * 60 * 60 * 1000      // 4 hours — H1 bars stay valid
const REFRESH_MS = 60 * 60 * 1000      // background-refresh after 1 hour

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

/** Cached bars within TTL, or null when missing / expired */
export function getCachedBars(sym: string): OHLCBar[] | null {
  const slot = read()[sym]
  if (!slot || Date.now() - slot.savedAt > TTL_MS) return null
  return slot.bars
}

/** True when cache exists but is older than REFRESH_MS (needs a silent refresh) */
export function isCacheStale(sym: string): boolean {
  const slot = read()[sym]
  if (!slot) return false
  return Date.now() - slot.savedAt > REFRESH_MS
}

/** Age of the cached entry in minutes, null if no cache */
export function getCacheAgeMinutes(sym: string): number | null {
  const slot = read()[sym]
  return slot ? Math.floor((Date.now() - slot.savedAt) / 60_000) : null
}

/** Persist fresh bars */
export function setCachedBars(sym: string, bars: OHLCBar[]) {
  const store = read()
  store[sym] = { bars, savedAt: Date.now() }
  write(store)
}

/** Returns cached bars regardless of TTL — used as weekend/closed-market fallback */
export function getCachedBarsAnyAge(sym: string): OHLCBar[] | null {
  const slot = read()[sym]
  return slot?.bars ?? null
}

// ── H4 bar cache (separate key, 8h TTL) ────────────────────────

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

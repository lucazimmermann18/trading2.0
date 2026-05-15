import type { OHLCBar } from "./types"

export async function fetchBars(sym: string, tf: string, outputsize = 150): Promise<OHLCBar[]> {
  try {
    const params = new URLSearchParams({ sym, tf, size: String(outputsize) })
    const res = await fetch(`/api/bars?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json() as OHLCBar[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchPrice(_sym: string): Promise<{ price: number; change: number; changePct: number } | null> {
  return null
}

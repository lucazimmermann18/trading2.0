import type { Pair, OHLCBar } from "./types"
import { calcBB, calcSwingLevels, fmt } from "./market-data"

export type ZoneType = "support" | "resistance" | "bb_lower" | "bb_upper" | "ob_bull" | "ob_bear"

export interface WatchedZone {
  id: string
  pairId: number
  sym: string
  digits: number
  price: number
  type: ZoneType
  strength: number   // 1–5
  label: string
  bandwidth: number  // ± this many price units = "in zone"
  createdAt: number
  lastTriggered?: number
}

// Detect Order Blocks: last opposing candle before a strong impulse move
function detectOrderBlocks(bars: OHLCBar[], vol: number): { price: number; type: "ob_bull" | "ob_bear" }[] {
  const out: { price: number; type: "ob_bull" | "ob_bear" }[] = []
  const threshold = vol * 2.5
  for (let i = 2; i < bars.length - 1; i++) {
    const impulse = Math.abs(bars[i + 1].close - bars[i + 1].open)
    if (impulse < threshold) continue
    if (bars[i + 1].close < bars[i + 1].open && bars[i].close > bars[i].open) {
      out.push({ price: (bars[i].high + bars[i].low) / 2, type: "ob_bear" })
    }
    if (bars[i + 1].close > bars[i + 1].open && bars[i].close < bars[i].open) {
      out.push({ price: (bars[i].high + bars[i].low) / 2, type: "ob_bull" })
    }
  }
  return [
    ...out.filter(o => o.type === "ob_bear").slice(-2),
    ...out.filter(o => o.type === "ob_bull").slice(-2),
  ]
}

export function computeZones(p: Pair): WatchedZone[] {
  const closes = p.history.map(b => b.close)
  const bb = calcBB(closes)
  const swings = calcSwingLevels(p.history)
  const obs = detectOrderBlocks(p.history.slice(-80), p.vol)
  const bw = p.vol * 1.8  // bandwidth = 1.8× avg candle range
  const now = Date.now()
  const zones: WatchedZone[] = []

  swings.support.forEach((price, i) => zones.push({
    id: `${p.id}-sup-${i}`, pairId: p.id, sym: p.sym, digits: p.digits,
    price, type: "support", strength: Math.max(1, 4 - i),
    label: `Support ${fmt(price, p.digits)}`,
    bandwidth: bw, createdAt: now,
  }))

  swings.resistance.forEach((price, i) => zones.push({
    id: `${p.id}-res-${i}`, pairId: p.id, sym: p.sym, digits: p.digits,
    price, type: "resistance", strength: Math.max(1, 4 - i),
    label: `Resistance ${fmt(price, p.digits)}`,
    bandwidth: bw, createdAt: now,
  }))

  zones.push({
    id: `${p.id}-bb-upper`, pairId: p.id, sym: p.sym, digits: p.digits,
    price: bb.upper, type: "bb_upper", strength: 2,
    label: `BB Upper ${fmt(bb.upper, p.digits)}`,
    bandwidth: bw * 0.8, createdAt: now,
  })
  zones.push({
    id: `${p.id}-bb-lower`, pairId: p.id, sym: p.sym, digits: p.digits,
    price: bb.lower, type: "bb_lower", strength: 2,
    label: `BB Lower ${fmt(bb.lower, p.digits)}`,
    bandwidth: bw * 0.8, createdAt: now,
  })

  obs.forEach((ob, i) => zones.push({
    id: `${p.id}-${ob.type}-${i}`, pairId: p.id, sym: p.sym, digits: p.digits,
    price: ob.price, type: ob.type, strength: 3,
    label: `${ob.type === "ob_bull" ? "Bull OB" : "Bear OB"} ${fmt(ob.price, p.digits)}`,
    bandwidth: bw * 1.2, createdAt: now,
  }))

  // Only keep zones within 2.5% of current price
  const maxDist = p.px * 0.025
  return zones.filter(z => Math.abs(z.price - p.px) <= maxDist)
}

export function isPriceInZone(price: number, zone: WatchedZone): boolean {
  return Math.abs(price - zone.price) <= zone.bandwidth
}

export const ZONE_COOLDOWN_MS = 10 * 60 * 1000   // 10 min cooldown per zone
export const ZONE_RECOMPUTE_MS = 5 * 60 * 1000   // recompute zones every 5 min

export function zoneColor(type: ZoneType): string {
  switch (type) {
    case "support":    return "#00ff88"
    case "ob_bull":    return "#00ff88"
    case "bb_lower":   return "#00d4ff"
    case "resistance": return "#ff3d5a"
    case "ob_bear":    return "#ff3d5a"
    case "bb_upper":   return "#00d4ff"
  }
}

"use client"
import { useEffect, useRef } from "react"
import type { Pair } from "@/app/lib/types"
import { type WatchedZone, isPriceInZone, ZONE_COOLDOWN_MS } from "@/app/lib/zones"

interface Props {
  pairs: Pair[]
  zones: WatchedZone[]
  enabled: boolean
  onZoneEntry: (pair: Pair, zone: WatchedZone) => void
}

export function useZoneWatcher({ pairs, zones, enabled, onZoneEntry }: Props) {
  const prevPricesRef = useRef<Map<number, number>>(new Map())
  const cooldownRef   = useRef<Map<string, number>>(new Map())
  const callbackRef   = useRef(onZoneEntry)
  callbackRef.current = onZoneEntry

  useEffect(() => {
    if (!enabled || zones.length === 0) return

    for (const pair of pairs) {
      const prevPx = prevPricesRef.current.get(pair.id)
      prevPricesRef.current.set(pair.id, pair.px)
      if (prevPx === undefined) continue

      const pairZones = zones.filter(z => z.pairId === pair.id)

      for (const zone of pairZones) {
        const wasIn = isPriceInZone(prevPx, zone)
        const isIn  = isPriceInZone(pair.px, zone)
        if (wasIn || !isIn) continue  // only fire on fresh entry

        const lastHit = cooldownRef.current.get(zone.id) ?? 0
        if (Date.now() - lastHit < ZONE_COOLDOWN_MS) continue

        cooldownRef.current.set(zone.id, Date.now())
        callbackRef.current(pair, zone)
      }
    }
  }, [pairs, zones, enabled])
}

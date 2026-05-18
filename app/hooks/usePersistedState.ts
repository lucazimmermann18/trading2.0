"use client"
import { useState, useEffect, useCallback } from "react"
import { dbLoadSettings, dbSaveSettings } from "@/app/lib/actions/settings"

const STORAGE_KEY = "tradeai_app_state"

interface PersistedState {
  activePairIds: number[]
  skillset: string
  threshold: number
  timeframe: string
  scannerOn: boolean
}

const DEFAULTS: PersistedState = {
  activePairIds: [0, 1, 2, 3, 4, 5, 6, 7],
  skillset: "Smart Money Concepts",
  threshold: 82,
  timeframe: "H1",
  scannerOn: true,
}

function readLocal(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {}
  } catch {
    return {}
  }
}

export function usePersistedState() {
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<PersistedState>(DEFAULTS)

  useEffect(() => {
    // 1. Apply localStorage immediately (fast, sync)
    const local = readLocal()
    if (Object.keys(local).length > 0) {
      setState(prev => ({ ...prev, ...local }))
    }

    // 2. Merge DB settings on top (authoritative source)
    dbLoadSettings().then(db => {
      setState(prev => {
        const merged: PersistedState = {
          activePairIds: db.active_pair_ids.length > 0 ? db.active_pair_ids : (local.activePairIds ?? prev.activePairIds),
          skillset:  db.skillset  || local.skillset  || prev.skillset,
          threshold: db.threshold ?? local.threshold ?? prev.threshold,
          timeframe: db.timeframe || local.timeframe || prev.timeframe,
          scannerOn: db.scanner_on ?? local.scannerOn ?? prev.scannerOn,
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
        return merged
      })
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  const save = useCallback((updates: Partial<PersistedState>) => {
    setState(prev => {
      const next = { ...prev, ...updates }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      // Write-through to DB (fire-and-forget)
      void dbSaveSettings({
        skillset:        next.skillset,
        threshold:       next.threshold,
        timeframe:       next.timeframe,
        scanner_on:      next.scannerOn,
        active_pair_ids: next.activePairIds,
      })
      return next
    })
  }, [])

  return { loaded, state, save }
}

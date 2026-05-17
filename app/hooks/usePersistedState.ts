"use client"
import { useState, useEffect, useCallback } from "react"

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

export function usePersistedState() {
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<PersistedState>(DEFAULTS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>
        setState(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
    setLoaded(true)
  }, [])

  const save = useCallback((updates: Partial<PersistedState>) => {
    setState(prev => {
      const next = { ...prev, ...updates }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { loaded, state, save }
}

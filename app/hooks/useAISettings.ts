"use client"
import { useState, useEffect, useCallback } from "react"
import type { AISettings, ProviderKey } from "@/app/lib/ai-providers"
import { DEFAULT_AI_SETTINGS, STORAGE_KEY } from "@/app/lib/ai-providers"

function load(): AISettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_AI_SETTINGS
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS)

  useEffect(() => { setSettings(load()) }, [])

  const save = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setApiKey = useCallback((provider: ProviderKey, key: string) => {
    setSettings(prev => {
      const next = { ...prev, apiKeys: { ...prev.apiKeys, [provider]: key } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setSelectedModel = useCallback((provider: ProviderKey, model: string) => {
    setSettings(prev => {
      const next = { ...prev, selectedModels: { ...prev.selectedModels, [provider]: model } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, save, setApiKey, setSelectedModel }
}

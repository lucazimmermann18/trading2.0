"use client"
import { useState, useEffect, useCallback } from "react"
import type { AISettings, ProviderKey } from "@/app/lib/ai-providers"
import { DEFAULT_AI_SETTINGS, STORAGE_KEY } from "@/app/lib/ai-providers"

// Only non-sensitive data lives in localStorage (no API keys)
interface LocalState {
  activeProvider: ProviderKey
  selectedModels: Record<ProviderKey, string>
  useAI: boolean
}

function loadLocal(): LocalState {
  if (typeof window === "undefined") return {
    activeProvider: DEFAULT_AI_SETTINGS.activeProvider,
    selectedModels: DEFAULT_AI_SETTINGS.selectedModels,
    useAI: DEFAULT_AI_SETTINGS.useAI,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {
      activeProvider: DEFAULT_AI_SETTINGS.activeProvider,
      selectedModels: DEFAULT_AI_SETTINGS.selectedModels,
      useAI: DEFAULT_AI_SETTINGS.useAI,
    }
    const p = JSON.parse(raw) as Partial<LocalState & { apiKeys?: unknown }>
    return {
      activeProvider: p.activeProvider ?? DEFAULT_AI_SETTINGS.activeProvider,
      selectedModels: { ...DEFAULT_AI_SETTINGS.selectedModels, ...(p.selectedModels ?? {}) },
      useAI: p.useAI ?? DEFAULT_AI_SETTINGS.useAI,
    }
  } catch {
    return {
      activeProvider: DEFAULT_AI_SETTINGS.activeProvider,
      selectedModels: DEFAULT_AI_SETTINGS.selectedModels,
      useAI: DEFAULT_AI_SETTINGS.useAI,
    }
  }
}

function persistLocal(s: AISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeProvider: s.activeProvider,
      selectedModels: s.selectedModels,
      useAI: s.useAI,
      // keyStatus intentionally excluded — fetched from DB on load
    }))
  } catch {}
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS)

  useEffect(() => {
    // Restore non-sensitive prefs from localStorage
    const local = loadLocal()
    setSettings(prev => ({ ...prev, ...local }))

    // Fetch key presence flags from DB (never the actual keys)
    fetch("/api/ai/key-status")
      .then(r => r.json())
      .then((status: Record<string, boolean>) => {
        setSettings(prev => ({
          ...prev,
          keyStatus: {
            anthropic: status.anthropic ?? false,
            openai:    status.openai    ?? false,
            deepseek:  status.deepseek  ?? false,
            gemini:    status.gemini    ?? false,
          },
        }))
      })
      .catch(() => {})
  }, [])

  const save = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      persistLocal(next)
      return next
    })
  }, [])

  /**
   * Save an API key to the database server-side.
   * Returns true on success. The key itself never enters client state.
   */
  const setApiKey = useCallback(async (provider: ProviderKey, key: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/ai/save-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key.trim(), model }),
      })
      if (!res.ok) return false
      setSettings(prev => ({ ...prev, keyStatus: { ...prev.keyStatus, [provider]: true } }))
      return true
    } catch {
      return false
    }
  }, [])

  const setSelectedModel = useCallback((provider: ProviderKey, model: string) => {
    setSettings(prev => {
      const next = { ...prev, selectedModels: { ...prev.selectedModels, [provider]: model } }
      persistLocal(next)
      return next
    })
  }, [])

  return { settings, save, setApiKey, setSelectedModel }
}

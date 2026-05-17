"use client"
import { useState, useEffect, useCallback } from "react"

export interface NotificationSettings {
  channels: {
    telegram: boolean
    webhook: boolean
    discord: boolean
    email: boolean
  }
  telegramToken: string
  telegramChatId: string
  webhookUrl: string
  discordWebhookUrl: string
  emailRecipient: string
}

const DEFAULT: NotificationSettings = {
  channels: { telegram: false, webhook: false, discord: false, email: false },
  telegramToken: "",
  telegramChatId: "",
  webhookUrl: "",
  discordWebhookUrl: "",
  emailRecipient: "",
}

const KEY = "tradeai_notif_settings"

function load(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT
  }
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT)
  useEffect(() => { setSettings(load()) }, [])

  const save = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setField = useCallback(<K extends keyof NotificationSettings>(
    key: K, value: NotificationSettings[K]
  ) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const sendSignal = useCallback(async (signal: {
    sym: string; side: "BUY"|"SELL"; entry: number; sl: number
    tp1: number; tp2: number; confidence: number; rr: string
    tf: string; skillset: string; why: string; digits: number
  }) => {
    const s = load()
    const anyEnabled = s.channels.telegram || s.channels.webhook || s.channels.discord
    if (!anyEnabled) return
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal,
          channels: s.channels,
          telegramToken: s.telegramToken,
          telegramChatId: s.telegramChatId,
          webhookUrl: s.webhookUrl,
          discordWebhookUrl: s.discordWebhookUrl,
        }),
      })
    } catch { /* silent */ }
  }, [])

  const sendLifecycleUpdate = useCallback(async (update: {
    sym: string; side: "BUY"|"SELL"; state: string; pnl_r?: number; entry: number; digits: number
  }) => {
    const s = load()
    if (!s.channels.telegram && !s.channels.webhook && !s.channels.discord) return
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lifecycle", lifecycle: update,
          channels: s.channels,
          telegramToken: s.telegramToken,
          telegramChatId: s.telegramChatId,
          webhookUrl: s.webhookUrl,
          discordWebhookUrl: s.discordWebhookUrl,
        }),
      })
    } catch { /* silent */ }
  }, [])

  return { settings, save, setField, sendSignal, sendLifecycleUpdate }
}

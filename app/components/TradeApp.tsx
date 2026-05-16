"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import NavRail from "./layout/NavRail"
import TopNav from "./layout/TopNav"
import LeftSidebar from "./layout/LeftSidebar"
import ChartPanel from "./chart/ChartPanel"
import AIPanel from "./panels/AIPanel"
import Toast, { ResolutionToast } from "./panels/Toast"
import SettingsModal from "./panels/SettingsModal"
import SignalDetailModal from "./panels/SignalDetailModal"
import MultiChartView from "./views/MultiChartView"
import HeatmapView from "./views/HeatmapView"
import PerformanceView from "./views/PerformanceView"
import JournalView from "./views/JournalView"
import ReplayView from "./views/ReplayView"
import SystemView from "./views/SystemView"
import type { Pair, HistoryEntry, ViewId, Timeframe, AuditEntry, AuditKind, SystemMetrics } from "@/app/lib/types"
import {
  buildInitialState,
  activeSessions, buildMarketContext, calcRSI, calcMACD,
  buildConfluences, SIGNAL_EXPIRY_MS, buildCorrelationMatrix,
} from "@/app/lib/market-data"
import { fetchBars } from "@/app/lib/twelvedata"
import { getCachedBars, getCachedBarsAnyAge, isCacheStale, setCachedBars,
         getCachedH4Bars, getCachedH4BarsAnyAge, setCachedH4Bars } from "@/app/lib/bar-cache"
import { useAISettings } from "@/app/hooks/useAISettings"
import { useTwelveDataWS } from "@/app/hooks/useTwelveDataWS"
import { usePersistedState } from "@/app/hooks/usePersistedState"
import { useNotificationSettings } from "@/app/hooks/useNotificationSettings"
import { useZoneWatcher } from "@/app/hooks/useZoneWatcher"
import { computeZones, type WatchedZone, ZONE_RECOMPUTE_MS } from "@/app/lib/zones"
import { useSignalLifecycle, type ResolvedSignal } from "@/app/hooks/useSignalLifecycle"
import { loadHistory, saveHistory, patchHistoryEntry } from "@/app/lib/history-store"


// ── Custom pair storage ───────────────────────────────────────
const CUSTOM_PAIRS_KEY = "tradeai_custom_pairs_v1"
interface CustomPairDef { sym: string; name: string; group: string; digits: number; spread: number }

function loadCustomDefs(): CustomPairDef[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(CUSTOM_PAIRS_KEY) ?? "[]") } catch { return [] }
}
function saveCustomDefs(defs: CustomPairDef[]) {
  try { localStorage.setItem(CUSTOM_PAIRS_KEY, JSON.stringify(defs)) } catch {}
}
function guessDigits(sym: string): number {
  if (sym.includes("JPY")) return 3
  if (sym.includes("XAU") || sym.includes("XAG")) return 2
  if (/BTC|ETH|SOL|AVAX/.test(sym)) return 2
  if (/XRP|DOGE/.test(sym)) return 4
  if (/[A-Z]+\/[A-Z]+/.test(sym)) return 5
  return 2
}

export default function TradeApp() {
  const [pairs, setPairs] = useState<Pair[]>([])
  const [selectedId, setSelectedId] = useState(7) // XAU/USD
  const [timeframe, setTimeframe] = useState<Timeframe>("H1")
  const [skillset, setSkillset] = useState("Smart Money Concepts")
  const [threshold, setThreshold] = useState(82)
  const [scannerOn, setScannerOn] = useState(true)
  const persistedAppliedRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(272)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState<{ pair: Pair; signal: NonNullable<Pair["signal"]> } | null>(null)
  const [resolvedToast, setResolvedToast] = useState<ResolvedSignal | null>(null)
  const [view, setView] = useState<ViewId>("dashboard")
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [sessions, setSessions] = useState(activeSessions())
  const [unread, setUnread] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<HistoryEntry | null>(null)
  const [zones, setZones] = useState<WatchedZone[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const auditIdRef = useRef(0)
  const [metrics, setMetrics] = useState<SystemMetrics>({
    scanCount: 0, signalCount: 0, tpCount: 0, slCount: 0, lastAILatency: 0,
  })
  const aiSettings = useAISettings()
  const notifSettings = useNotificationSettings()
  const { loaded: persLoaded, state: persState, save: persSave } = usePersistedState()

  const logEvent = useCallback((kind: AuditKind, msg: string) => {
    setAuditLog(prev => [{ id: auditIdRef.current++, time: Date.now(), kind, msg }, ...prev].slice(0, 120))
  }, [])

  // Persist signal history to localStorage on every change
  useEffect(() => {
    saveHistory(history)
  }, [history])

  // Live WebSocket prices
  const activeSymbols = pairs.filter(p => p.active).map(p => p.sym)
  const { connected: wsConnected } = useTwelveDataWS({
    symbols: activeSymbols,
    enabled: activeSymbols.length > 0,
    onPrice: (sym, price) => {
      setPairs(prev => prev.map(p => {
        if (p.sym !== sym) return p
        const now = Math.floor(Date.now() / 1000)
        const last = p.history[p.history.length - 1]
        const updHistory = last && now - last.time < 60
          ? [...p.history.slice(0, -1), { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }]
          : [...p.history.slice(-219), { time: now, open: p.px, high: Math.max(p.px, price), low: Math.min(p.px, price), close: price, volume: 0 }]
        return { ...p, px: price, history: updHistory }
      }))
    },
  })

  // WS reconnect banner
  const [wsBanner, setWsBanner] = useState<"disconnected" | "reconnected" | null>(null)
  const prevWsConnected = useRef<boolean | null>(null)
  const wsBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (prevWsConnected.current === null) { prevWsConnected.current = wsConnected; return }
    const prev = prevWsConnected.current
    prevWsConnected.current = wsConnected
    if (prev && !wsConnected) {
      if (wsBannerTimerRef.current) clearTimeout(wsBannerTimerRef.current)
      setWsBanner("disconnected")
      logEvent("feed", "⚠ WebSocket disconnected — reconnecting…")
    } else if (!prev && wsConnected) {
      if (wsBannerTimerRef.current) clearTimeout(wsBannerTimerRef.current)
      setWsBanner("reconnected")
      logEvent("feed", "✓ WebSocket reconnected — live prices restored")
      wsBannerTimerRef.current = setTimeout(() => setWsBanner(null), 4000)
    }
  }, [wsConnected, logEvent])

  const barFetchRef = useRef(false)

  // Build initial pairs — hydrate from localStorage cache instantly, then
  // schedule a background refresh for stale / missing entries.
  useEffect(() => {
    if (barFetchRef.current) return
    barFetchRef.current = true

    const initialPairs = buildInitialState()

    // Pass 1: load from cache synchronously so the UI has data immediately
    const hydratedPairs = initialPairs.map(p => {
      if (!p.active) return p
      const cached = getCachedBars(p.sym)
      if (!cached) return p
      const closes = cached.map(b => b.close)
      return {
        ...p,
        history: cached,
        rsi: calcRSI(closes),
        macd: calcMACD(closes).macdLine,
        px: cached[cached.length - 1].close,
      }
    })
    // Load custom pairs from localStorage and append
    const customDefs = loadCustomDefs()
    const customPairs: Pair[] = customDefs.map((def, i) => {
      const id = 1000 + i
      const cached = getCachedBars(def.sym)
      const closes = cached?.map(b => b.close) ?? []
      return {
        id, sym: def.sym, name: def.name, group: def.group, digits: def.digits,
        spread: def.spread, vol: 0, px: cached ? cached[cached.length - 1].close : 0,
        active: true, status: "NO TRADE" as const, signal: null, lastScan: 0,
        history: cached ?? [], h4History: undefined,
        reasoning: "Waiting for market data…", confidence: 0,
        rsi: closes.length ? calcRSI(closes) : 50,
        macd: closes.length ? calcMACD(closes).macdLine : 0,
      }
    })
    const allPairs = [...hydratedPairs, ...customPairs]
    setPairs(allPairs)

    // Pass 2: refresh entries that are missing or older than 1 h
    let fetchIdx = 0
    allPairs.filter(p => p.active).forEach(p => {
      const needsFetch = p.history.length < 50 || isCacheStale(p.sym)
      if (!needsFetch) return

      const delay = fetchIdx++ * 500
      setTimeout(async () => {
        try {
          // H1 fetch
          let bars = await fetchBars(p.sym, "H1", 220)
          let fromCache = false
          if (!bars.length) {
            const stale = getCachedBarsAnyAge(p.sym)
            if (stale?.length) { bars = stale; fromCache = true }
          }
          if (!bars.length) { logEvent("feed", `${p.sym} · no data — market may be closed`); return }
          if (!fromCache) setCachedBars(p.sym, bars)

          // H4 fetch (in parallel, staggered +200ms to avoid rate limit)
          const h4Bars = getCachedH4Bars(p.sym)
          if (!h4Bars) {
            setTimeout(async () => {
              try {
                let fetched = await fetchBars(p.sym, "H4", 150)
                if (!fetched.length) {
                  const stale = getCachedH4BarsAnyAge(p.sym)
                  if (stale?.length) fetched = stale
                }
                if (fetched.length) {
                  setCachedH4Bars(p.sym, fetched)
                  setPairs(prev => prev.map(q => q.id !== p.id ? q : { ...q, h4History: fetched }))
                }
              } catch { /* non-critical */ }
            }, 200)
          }

          const closes = bars.map(b => b.close)
          const rsi = calcRSI(closes)
          const { macdLine } = calcMACD(closes)
          setPairs(prev => prev.map(pair =>
            pair.id !== p.id ? pair
              : { ...pair, history: bars, h4History: h4Bars ?? pair.h4History, rsi, macd: macdLine, px: bars[bars.length - 1].close }
          ))
          const label = fromCache ? "cached (market closed)" : p.history.length < 50 ? "loaded" : "refreshed"
          logEvent("feed", `${p.sym} · ${bars.length} H1${h4Bars ? ` + ${h4Bars.length} H4` : ""} bars ${label}`)
        } catch {
          logEvent("feed", `${p.sym} · bar fetch failed`)
        }
      }, delay)
    })
  }, [logEvent])

  // Derived warmup state — true once every active pair has ≥ 50 bars
  const activePairsList = pairs.filter(p => p.active)
  const barsReadyCount  = activePairsList.filter(p => p.history.length >= 50).length
  const warmupDone      = activePairsList.length === 0 || barsReadyCount >= activePairsList.length

  // Keep a ref so the interval can read it without re-subscribing
  const warmupDoneRef = useRef(warmupDone)
  warmupDoneRef.current = warmupDone

  // Apply persisted state once localStorage is loaded
  useEffect(() => {
    if (!persLoaded || persistedAppliedRef.current || pairs.length === 0) return
    persistedAppliedRef.current = true
    const s = persState
    if (s.skillset) setSkillset(s.skillset)
    if (s.threshold) setThreshold(s.threshold)
    if (s.timeframe) setTimeframe(s.timeframe as Timeframe)
    setScannerOn(s.scannerOn)
    if (s.activePairIds.length > 0) {
      const ids = new Set(s.activePairIds)
      setPairs(prev => prev.map(p => ({ ...p, active: ids.has(p.id) })))
    }
  }, [persLoaded, pairs.length, persState])

  // Scanner countdown — holds at 300 until all active pairs have enough history
  useEffect(() => {
    const i = setInterval(() => {
      setSecondsLeft(s => {
        if (!warmupDoneRef.current) return 300  // hold during warmup
        return scannerOn ? (s > 0 ? s - 1 : 300) : s
      })
      setSessions(activeSessions())
    }, 1000)
    return () => clearInterval(i)
  }, [scannerOn])

  const runScan = useCallback(async () => {
    const { settings } = aiSettings
    const useAI = settings.useAI && !!settings.apiKeys[settings.activeProvider]
    if (!useAI) {
      logEvent("config", "AI not configured — add an API key in Settings to enable scanning")
      return
    }

    setScanning(true)

    // Session gate: skip scan entirely if outside London / New York hours
    const activeSess = activeSessions()
    const sessionActive = activeSess.some(s => (s.key === "london" || s.key === "ny") && s.active)
    if (!sessionActive) {
      logEvent("scan", "Scan skipped — outside London/NY session (low liquidity)")
      setScanning(false)
      return
    }

    const activePairs = pairs.filter(p => p.active && p.history.length >= 50)
    if (!activePairs.length) {
      logEvent("feed", "Scan skipped — waiting for market data to finish loading")
      setScanning(false)
      return
    }
    logEvent("scan", `Scan started — ${activePairs.length} pairs · ${activeSess.filter(s => s.active).map(s => s.label).join("+")} session`)

    const results = new Map<number, NonNullable<Pair["signal"]> | null>()
    const latencies: number[] = []

    await Promise.allSettled(
      activePairs.map(async p => {
        try {
          const ctx = buildMarketContext(p)

          // Client-side pre-filter: skip if spread > 0.08% (execution slippage kills edge)
          const spreadPct = (p.spread / p.px) * 100
          if (spreadPct > 0.08) {
            logEvent("scan", `${p.sym} · skipped — spread ${spreadPct.toFixed(3)}% too wide`)
            results.set(p.id, null)
            return
          }

          // Client-side pre-filter: skip if price not near any SMC level
          const atr = ctx.atr
          const px = p.px
          const nearOB = ctx.smc.orderBlocks.some(ob => px >= ob.low - atr * 0.4 && px <= ob.high + atr * 0.4)
          const nearH4OB = ctx.smc.h4OrderBlocks.some(ob => px >= ob.low - atr * 0.5 && px <= ob.high + atr * 0.5)
          const nearFVG = ctx.smc.fvgs.some(fvg => px >= fvg.bottom - atr * 0.3 && px <= fvg.top + atr * 0.3)
          const hasSweep = ctx.smc.sweeps.length > 0
          if (!nearOB && !nearH4OB && !nearFVG && !hasSweep) {
            logEvent("scan", `${p.sym} · skipped — price not near any OB/FVG/sweep`)
            results.set(p.id, null)
            return
          }

          const t0 = Date.now()
          const res = await fetch("/api/ai/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: settings.activeProvider,
              model: settings.selectedModels[settings.activeProvider],
              apiKey: settings.apiKeys[settings.activeProvider],
              sym: p.sym, px: p.px, digits: p.digits, spread: p.spread,
              history: p.history.slice(-50),
              skillset, timeframe,
              rsi: ctx.rsi, macdLine: ctx.macdLine, signalLine: ctx.signalLine,
              histogram: ctx.histogram, bb: ctx.bb, trend: ctx.trend,
              support: ctx.swings.support, resistance: ctx.swings.resistance,
              activeSessions: ctx.activeSessions,
              atr: ctx.atr, candlePatterns: ctx.candlePatterns, htf: ctx.htf,
              smc: ctx.smc,
            }),
          })
          const lat = Date.now() - t0
          latencies.push(lat)
          if (!res.ok) { logEvent("ai", `${p.sym} · ${settings.activeProvider} error · ${lat}ms`); results.set(p.id, null); return }
          const data = await res.json()
          if (data.side === "NO TRADE" || data.confidence < threshold) {
            logEvent("ai", `${p.sym} · NO TRADE · ${data.confidence}% conf · ${lat}ms`)
            results.set(p.id, null)
          } else {
            logEvent("signal", `${p.sym} ${data.side} · conf ${data.confidence}% · ${lat}ms`)
            const now = Date.now()
            results.set(p.id, {
              side: data.side, confidence: data.confidence,
              entry: data.entry, sl: data.sl, tp1: data.tp1, tp2: data.tp2,
              rr: data.rr ?? "3.00", tf: timeframe, skillset,
              why: data.reasoning, time: now,
              expiresAt: now + (SIGNAL_EXPIRY_MS[timeframe] ?? SIGNAL_EXPIRY_MS.H1),
              confluences: buildConfluences(ctx.smc, data.side),
            })
          }
        } catch {
          results.set(p.id, null)
        }
      })
    )

    const avgLat = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0
    let sigCount = 0

    // Collect signals and detect correlated pairs firing simultaneously
    const signalPairs: Array<{ p: Pair; sig: NonNullable<Pair["signal"]> }> = []
    for (const [pairId, sig] of Array.from(results)) {
      if (!sig) continue
      sigCount++
      const p = activePairs.find(ap => ap.id === pairId)!
      signalPairs.push({ p, sig })
      setToast({ pair: p, signal: sig })
      setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h].slice(0, 200))
      setUnread(u => u + 1)
      notifSettings.sendSignal({ ...sig, sym: p.sym, digits: p.digits })
    }

    // Correlation warning: warn when 2+ signals share highly correlated pairs
    if (signalPairs.length >= 2) {
      const matrix = buildCorrelationMatrix(pairs)
      const warned = new Set<string>()
      for (let i = 0; i < signalPairs.length; i++) {
        for (let j = i + 1; j < signalPairs.length; j++) {
          const symA = signalPairs[i].p.sym
          const symB = signalPairs[j].p.sym
          const key = [symA, symB].sort().join("|")
          if (warned.has(key)) continue
          const rowA = matrix.find(r => r.sym === symA)
          const idxB = matrix.findIndex(r => r.sym === symB)
          if (rowA && idxB !== -1 && Math.abs(rowA.row[idxB]) > 0.7) {
            warned.add(key)
            logEvent("signal", `⚠ Correlation warning: ${symA} & ${symB} are highly correlated (${(rowA.row[idxB] * 100).toFixed(0)}%) — consider sizing down`)
          }
        }
      }
    }

    setPairs(prev => prev.map(p => {
      if (!p.active) return p
      const sig = results.get(p.id)
      if (sig) return { ...p, status: "TRADE" as const, signal: sig, lastScan: Date.now(), confidence: sig.confidence }
      return { ...p, status: "NO TRADE" as const, signal: null, lastScan: Date.now(), confidence: 0, reasoning: "No high-probability setup — monitoring for next opportunity." }
    }))

    logEvent("scan", `Scan complete — ${sigCount} signal${sigCount !== 1 ? "s" : ""} · avg ${avgLat}ms`)
    setMetrics(prev => ({ ...prev, scanCount: prev.scanCount + 1, signalCount: prev.signalCount + sigCount, lastAILatency: avgLat }))
    setScanning(false)
  }, [skillset, threshold, timeframe, pairs, aiSettings, notifSettings, logEvent])

  useEffect(() => {
    if (secondsLeft === 0 && scannerOn) runScan()
  }, [secondsLeft, scannerOn, runScan])

  // ── Zone system ──────────────────────────────────────────────

  // Recompute zones whenever pairs update, then every 5 min
  useEffect(() => {
    if (pairs.length === 0) return
    const recompute = () =>
      setZones(pairs.filter(p => p.active).flatMap(p => computeZones(p)))
    recompute()
    const i = setInterval(recompute, ZONE_RECOMPUTE_MS)
    return () => clearInterval(i)
  }, [pairs])

  // Single-pair analysis triggered by zone entry or manual trigger
  const runPairScan = useCallback(async (p: Pair, triggerLabel: string) => {
    const { settings } = aiSettings
    const useAI = settings.useAI && !!settings.apiKeys[settings.activeProvider]
    const isManual = triggerLabel === "Manual"

    if (!useAI) {
      logEvent("config", `${p.sym} · AI not configured — add an API key in Settings`)
      return
    }

    if (p.history.length < 50) {
      logEvent("feed", `${p.sym} · skipped — market data still loading (${p.history.length} bars)`)
      return
    }

    logEvent(isManual ? "scan" : "zone", isManual ? `Manual analysis — ${p.sym}` : `Zone entry: ${p.sym} → ${triggerLabel}`)

    let sig: NonNullable<Pair["signal"]> | null = null

    try {
      const ctx = buildMarketContext(p)
      const t0 = Date.now()
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.activeProvider,
          model: settings.selectedModels[settings.activeProvider],
          apiKey: settings.apiKeys[settings.activeProvider],
          sym: p.sym, px: p.px, digits: p.digits, spread: p.spread,
          history: p.history.slice(-50), skillset, timeframe,
          rsi: ctx.rsi, macdLine: ctx.macdLine, signalLine: ctx.signalLine,
          histogram: ctx.histogram, bb: ctx.bb, trend: ctx.trend,
          support: ctx.swings.support, resistance: ctx.swings.resistance,
          activeSessions: ctx.activeSessions,
          atr: ctx.atr, candlePatterns: ctx.candlePatterns, htf: ctx.htf,
          smc: ctx.smc,
        }),
      })
      const lat = Date.now() - t0
      if (res.ok) {
        const data = await res.json()
        logEvent("ai", `${p.sym} · ${settings.activeProvider} · ${lat}ms`)
        setMetrics(prev => ({ ...prev, lastAILatency: lat }))
        if (data.side !== "NO TRADE" && data.confidence >= threshold) {
          const now = Date.now()
          sig = {
            side: data.side, confidence: data.confidence,
            entry: data.entry, sl: data.sl, tp1: data.tp1, tp2: data.tp2,
            rr: data.rr ?? "3.00", tf: timeframe, skillset,
            why: `[${triggerLabel}] ${data.reasoning}`, time: now,
            expiresAt: now + (SIGNAL_EXPIRY_MS[timeframe] ?? SIGNAL_EXPIRY_MS.H1),
            confluences: buildConfluences(ctx.smc, data.side),
          }
        }
      }
    } catch { /* silent */ }

    if (!sig) {
      logEvent("scan", `${p.sym} · NO TRADE`)
      return
    }

    logEvent("signal", `${p.sym} ${sig.side} · conf ${sig.confidence}%`)
    setMetrics(prev => ({ ...prev, signalCount: prev.signalCount + 1 }))
    setPairs(prev => prev.map(q =>
      q.id !== p.id ? q : { ...q, status: "TRADE" as const, signal: sig!, lastScan: Date.now(), confidence: sig!.confidence }
    ))
    setToast({ pair: p, signal: sig })
    setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig!, state: "ACTIVE" as const }, ...h].slice(0, 200))
    setUnread(u => u + 1)
    notifSettings.sendSignal({ ...sig, sym: p.sym, digits: p.digits })
  }, [aiSettings, skillset, timeframe, threshold, notifSettings, logEvent])

  useZoneWatcher({
    pairs: pairs.filter(p => p.active),
    zones,
    enabled: scannerOn,
    onZoneEntry: useCallback((pair, zone) => {
      runPairScan(pair, zone.label)
    }, [runPairScan]),
  })

  // ── Signal Lifecycle — auto-resolve TP1 / TP2 / SL ──────────
  useSignalLifecycle({
    pairs,
    history,
    setHistory,
    setPairs,
    onResolve: useCallback((resolved: ResolvedSignal) => {
      setResolvedToast(resolved)
      const { entry, newState, pnl_r } = resolved
      const pnlStr = `${pnl_r > 0 ? "+" : ""}${pnl_r.toFixed(2)}R`
      if (newState === "TP1") logEvent("tp", `${entry.sym} TP1 hit · ${pnlStr}`)
      else if (newState === "TP2") logEvent("tp", `${entry.sym} TP2 hit · ${pnlStr} (full target)`)
      else if (newState === "EXPIRED") logEvent("scan", `${entry.sym} signal expired — setup no longer valid`)
      else logEvent("sl", `${entry.sym} stop loss hit · ${pnlStr}`)
      // Patch the persisted entry immediately so a page reload shows the resolved state
      patchHistoryEntry(entry.sym, entry.time, { state: newState, pnl_r })
      setMetrics(prev => ({
        ...prev,
        tpCount: newState !== "SL" && newState !== "EXPIRED" ? prev.tpCount + 1 : prev.tpCount,
        slCount: newState === "SL" ? prev.slCount + 1 : prev.slCount,
      }))
    }, [logEvent]),
  })

  const prevWsRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevWsRef.current === null) { prevWsRef.current = wsConnected; return }
    if (wsConnected !== prevWsRef.current) {
      logEvent("feed", wsConnected ? "Twelve Data WebSocket connected" : "Twelve Data WebSocket disconnected")
      prevWsRef.current = wsConnected
    }
  }, [wsConnected, logEvent])

  const onToggleActive = (id: number) => {
    setPairs(prev => {
      const next = prev.map(p => p.id === id ? { ...p, active: !p.active } : p)
      persSave({ activePairIds: next.filter(p => p.active).map(p => p.id) })
      const pair = next.find(p => p.id === id)
      if (pair?.active && pair.history.length < 50) {
        fetchBars(pair.sym, "H1", 220).then(apiBars => {
          let bars = apiBars
          let fromCache = false
          if (!bars.length) {
            const stale = getCachedBarsAnyAge(pair.sym)
            if (stale?.length) { bars = stale; fromCache = true }
          }
          if (!bars.length) { logEvent("feed", `${pair.sym} · no data — market may be closed`); return }
          if (!fromCache) setCachedBars(pair.sym, bars)
          const closes = bars.map(b => b.close)
          const rsi = calcRSI(closes)
          const { macdLine } = calcMACD(closes)
          setPairs(prev2 => prev2.map(p =>
            p.id !== id ? p : { ...p, history: bars, rsi, macd: macdLine, px: bars[bars.length - 1].close }
          ))
          logEvent("feed", `${pair.sym} · ${bars.length} H1 bars ${fromCache ? "cached (market closed)" : "loaded"}`)
        }).catch(() => logEvent("feed", `${pair.sym} · bar fetch failed`))
      }
      return next
    })
  }

  const handleSetSkillset = (v: string) => { setSkillset(v); persSave({ skillset: v }); logEvent("config", `Skillset → ${v}`) }
  const handleSetThreshold = (v: number) => { setThreshold(v); persSave({ threshold: v }); logEvent("config", `Signal threshold → ${v}%`) }
  const handleSetTimeframe = (v: Timeframe) => { setTimeframe(v); persSave({ timeframe: v }); logEvent("config", `Timeframe → ${v}`) }
  const handleSetScannerOn = (v: boolean) => { setScannerOn(v); persSave({ scannerOn: v }); logEvent("config", v ? "AI Scanner started" : "AI Scanner paused") }

  const handleAddCustomPair = (sym: string, group: string) => {
    const digits = guessDigits(sym)
    const existingCustom = pairs.filter(p => p.id >= 1000)
    const id = 1000 + existingCustom.length
    const def: CustomPairDef = { sym, name: sym, group, digits, spread: 1.0 }
    const defs = loadCustomDefs()
    saveCustomDefs([...defs, def])
    const newPair: Pair = {
      id, sym, name: sym, group, digits, spread: 1.0, vol: 0, px: 0,
      active: true, status: "NO TRADE" as const, signal: null, lastScan: 0,
      history: [], h4History: undefined,
      reasoning: "Waiting for market data…", confidence: 0, rsi: 50, macd: 0,
    }
    setPairs(prev => [...prev, newPair])
    logEvent("config", `Added custom pair: ${sym}`)
    // Fetch bars immediately
    fetchBars(sym, "H1", 220).then(bars => {
      if (!bars.length) return
      setCachedBars(sym, bars)
      const closes = bars.map(b => b.close)
      setPairs(prev => prev.map(p =>
        p.id !== id ? p : { ...p, history: bars, rsi: calcRSI(closes), macd: calcMACD(closes).macdLine, px: bars[bars.length - 1].close }
      ))
      logEvent("feed", `${sym} · ${bars.length} H1 bars loaded`)
    }).catch(() => logEvent("feed", `${sym} · bar fetch failed — check symbol`))
  }

  const handleRemoveCustomPair = (id: number) => {
    const p = pairs.find(q => q.id === id)
    if (!p) return
    setPairs(prev => prev.filter(q => q.id !== id))
    const defs = loadCustomDefs().filter(d => d.sym !== p.sym)
    saveCustomDefs(defs)
    logEvent("config", `Removed custom pair: ${p.sym}`)
  }

  const handleOpenPair = (id: number) => {
    setSelectedId(id)
    setView("dashboard")
  }

  const selected = pairs.find(p => p.id === selectedId) ?? pairs[0]

  if (!selected) return (
    <div className="flex items-center justify-center h-screen bg-ink-950">
      <div className="w-8 h-8 border-2 border-white/10 border-t-accent-blue rounded-full animate-spin" />
    </div>
  )

  const isFullView = view !== "dashboard"

  return (
    <div className="flex flex-col h-screen bg-ink-950 overflow-hidden">
      <TopNav
        scannerOn={scannerOn}
        setScannerOn={handleSetScannerOn}
        notifications={unread}
        sessions={sessions}
        onOpenSettings={() => setSettingsOpen(true)}
        wsConnected={wsConnected}
      />

      {/* WS status banner */}
      {wsBanner && (
        <div className={`h-8 flex items-center justify-between px-4 text-[11px] font-medium tracking-[0.12em] transition shrink-0
          ${wsBanner === "disconnected"
            ? "bg-amber-500/10 border-b border-amber-500/20 text-amber-400"
            : "bg-accent-green/10 border-b border-accent-green/20 text-accent-green"}`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${wsBanner === "disconnected" ? "bg-amber-400 animate-pulse" : "bg-accent-green"}`}/>
            {wsBanner === "disconnected"
              ? "⚠ WebSocket disconnected — reconnecting automatically…"
              : "✓ WebSocket reconnected — live prices restored"}
          </div>
          {wsBanner === "disconnected" && (
            <button onClick={() => setWsBanner(null)} className="text-amber-400/60 hover:text-amber-400 transition">✕</button>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <NavRail
          view={view}
          setView={v => {
            setView(v)
            if (v === "journal" || v === "performance") setUnread(0)
          }}
          badges={{ journal: unread }}
        />

        <LeftSidebar
          pairs={pairs}
          selectedId={selectedId}
          onSelect={id => { setSelectedId(id); if (isFullView) setView("dashboard") }}
          onToggleActive={onToggleActive}
          secondsLeft={secondsLeft}
          scanning={scanning}
          scannerOn={scannerOn}
          zones={zones}
          warmupDone={warmupDone}
          barsReady={barsReadyCount}
          totalActive={activePairsList.length}
        />

        {/* Main content area */}
        {view === "dashboard" && (
          <>
            <ChartPanel pair={selected} timeframe={timeframe} setTimeframe={handleSetTimeframe} />
            <AIPanel
              pair={selected}
              skillset={skillset}
              setSkillset={handleSetSkillset}
              history={history}
              threshold={threshold}
              setThreshold={handleSetThreshold}
              scanning={scanning}
              onScanPair={() => runPairScan(selected, "Manual")}
              aiConfigured={aiSettings.settings.useAI && !!aiSettings.settings.apiKeys[aiSettings.settings.activeProvider]}
            />
          </>
        )}

        {view === "multichart"   && <MultiChartView pairs={pairs} onOpen={handleOpenPair} />}
        {view === "heatmap"      && <HeatmapView pairs={pairs} />}
        {view === "performance"  && <PerformanceView history={history} />}
        {view === "journal"      && <JournalView history={history} onOpen={setSelectedSignal} onUpdateNote={(sym, time, notes) => {
            patchHistoryEntry(sym, time, { notes })
            setHistory(prev => prev.map(h => h.sym === sym && h.time === time ? { ...h, notes } : h))
          }} />}
        {view === "replay"       && <ReplayView history={history} pairs={pairs} />}
        {view === "system" && (
          <SystemView
            auditLog={auditLog}
            metrics={metrics}
            wsConnected={wsConnected}
            activePairs={pairs.filter(p => p.active).length}
            totalPairs={pairs.length}
            aiEnabled={aiSettings.settings.useAI}
            aiProvider={aiSettings.settings.activeProvider}
            barsLoaded={barsReadyCount}
            totalActive={activePairsList.length}
          />
        )}
      </div>

      <ResolutionToast
        resolved={resolvedToast}
        onDismiss={() => setResolvedToast(null)}
      />

      <Toast
        signal={toast?.signal ?? null}
        pair={toast?.pair ?? null}
        onDismiss={() => setToast(null)}
        onView={() => {
          if (toast) { setSelectedId(toast.pair.id); setView("dashboard"); setToast(null) }
        }}
      />

      <SignalDetailModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        pairs={pairs}
        onTogglePair={onToggleActive}
        onAddPair={handleAddCustomPair}
        onRemovePair={handleRemoveCustomPair}
        skillset={skillset}
        setSkillset={handleSetSkillset}
        threshold={threshold}
        setThreshold={handleSetThreshold}
        aiSettings={aiSettings}
        notifSettings={notifSettings}
      />
    </div>
  )
}

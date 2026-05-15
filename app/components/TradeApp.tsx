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
import type { Pair, HistoryEntry, KnowledgeModule, ViewId, Timeframe, AuditEntry, AuditKind, SystemMetrics } from "@/app/lib/types"
import {
  buildInitialState, tickPair, makeSignal, KNOWLEDGE,
  activeSessions, pick, fmt, generateHistory, buildMarketContext,
} from "@/app/lib/market-data"
import { useAISettings } from "@/app/hooks/useAISettings"
import { useTwelveDataWS } from "@/app/hooks/useTwelveDataWS"
import { usePersistedState } from "@/app/hooks/usePersistedState"
import { useNotificationSettings } from "@/app/hooks/useNotificationSettings"
import { useZoneWatcher } from "@/app/hooks/useZoneWatcher"
import { computeZones, type WatchedZone, ZONE_RECOMPUTE_MS } from "@/app/lib/zones"
import { useSignalLifecycle, type ResolvedSignal } from "@/app/hooks/useSignalLifecycle"

const REASONING_NO_TRADE = [
  "{sym} consolidating inside {h}/{l} range. Compression building, awaiting directional break.",
  "{sym} showing mixed structure on H1. No clean liquidity sweep yet, monitoring for displacement.",
  "{sym} sitting at mid-range. Insufficient confluence — waiting for session open to confirm bias.",
  "{sym} respecting {h} resistance for now. No bearish BOS confirmed, no entry.",
  "{sym} chopping under {h}. Order flow neutral, RSI flat, no edge.",
]

export default function TradeApp() {
  const [pairs, setPairs] = useState<Pair[]>([])
  const [selectedId, setSelectedId] = useState(7) // XAU/USD
  const [timeframe, setTimeframe] = useState<Timeframe>("H1")
  const [skillset, setSkillset] = useState("Smart Money Concepts")
  const [knowledge, setKnowledge] = useState<KnowledgeModule[]>(KNOWLEDGE)
  const [threshold, setThreshold] = useState(75)
  const [scannerOn, setScannerOn] = useState(true)
  const persistedAppliedRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(272)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState<{ pair: Pair; signal: NonNullable<Pair["signal"]> } | null>(null)
  const [resolvedToast, setResolvedToast] = useState<ResolvedSignal | null>(null)
  const [view, setView] = useState<ViewId>("dashboard")
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [sessions, setSessions] = useState(activeSessions())
  const [unread, setUnread] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<HistoryEntry | null>(null)
  const [zones, setZones] = useState<WatchedZone[]>([])
  const seededRef = useRef(false)
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
          : [...p.history.slice(-219), { time: now, open: p.px, high: Math.max(p.px, price), low: Math.min(p.px, price), close: price, volume: 500 }]
        return { ...p, px: price, history: updHistory }
      }))
    },
  })

  // Build initial pairs + seed 14-day history
  useEffect(() => {
    const initialPairs = buildInitialState()
    setPairs(initialPairs)
    setHistory(generateHistory(initialPairs, 14))
  }, [])

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
    if (Object.keys(s.knowledge).length > 0) {
      setKnowledge(prev => prev.map(k => ({
        ...k,
        on: k.key in s.knowledge ? s.knowledge[k.key] : k.on,
      })))
    }
  }, [persLoaded, pairs.length, persState])

  // Live price ticking
  useEffect(() => {
    const i = setInterval(() => setPairs(prev => prev.map(tickPair)), 800)
    return () => clearInterval(i)
  }, [])

  // Scanner countdown + session refresh
  useEffect(() => {
    const i = setInterval(() => {
      setSecondsLeft(s => scannerOn ? (s > 0 ? s - 1 : 300) : s)
      setSessions(activeSessions())
    }, 1000)
    return () => clearInterval(i)
  }, [scannerOn])

  const runScan = useCallback(async () => {
    setScanning(true)
    const { settings } = aiSettings
    const useAI = settings.useAI && !!settings.apiKeys[settings.activeProvider]
    const activePairs = pairs.filter(p => p.active)
    logEvent("scan", `Scan started — ${activePairs.length} pair${activePairs.length !== 1 ? "s" : ""}`)

    if (useAI) {
      const results = new Map<number, NonNullable<Pair["signal"]> | null>()
      const latencies: number[] = []

      await Promise.allSettled(
        activePairs.map(async p => {
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
                history: p.history.slice(-50),
                skillset, timeframe,
                rsi: ctx.rsi, macdLine: ctx.macdLine, signalLine: ctx.signalLine,
                histogram: ctx.histogram, bb: ctx.bb, trend: ctx.trend,
                support: ctx.swings.support, resistance: ctx.swings.resistance,
                activeSessions: ctx.activeSessions,
                atr: ctx.atr, candlePatterns: ctx.candlePatterns, htf: ctx.htf,
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
              results.set(p.id, {
                side: data.side, confidence: data.confidence,
                entry: data.entry, sl: data.sl, tp1: data.tp1, tp2: data.tp2,
                rr: data.rr ?? "2.00", tf: timeframe, skillset,
                why: data.reasoning, time: Date.now(),
              })
            }
          } catch {
            results.set(p.id, null)
          }
        })
      )

      const avgLat = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0
      let sigCount = 0

      for (const [pairId, sig] of Array.from(results)) {
        if (!sig) continue
        sigCount++
        const p = activePairs.find(ap => ap.id === pairId)!
        setToast({ pair: p, signal: sig })
        setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h].slice(0, 200))
        setUnread(u => u + 1)
        notifSettings.sendSignal({ ...sig, sym: p.sym, digits: p.digits })
      }

      setPairs(prev => prev.map(p => {
        if (!p.active) return p
        const sig = results.get(p.id)
        if (sig) return { ...p, status: "TRADE" as const, signal: sig, lastScan: Date.now(), confidence: sig.confidence }
        return {
          ...p, status: "NO TRADE" as const, signal: null, lastScan: Date.now(),
          confidence: Math.floor(15 + Math.random() * 50),
          reasoning: pick(REASONING_NO_TRADE)
            .replace("{sym}", p.sym)
            .replace("{h}", fmt(p.px + p.vol * 3, p.digits))
            .replace("{l}", fmt(p.px - p.vol * 3, p.digits))
            .replace("{entry}", fmt(p.px, p.digits)),
          rsi: 30 + Math.random() * 40,
          macd: (Math.random() - 0.5) * 0.5,
        }
      }))

      logEvent("scan", `Scan complete — ${sigCount} signal${sigCount !== 1 ? "s" : ""} · avg ${avgLat}ms`)
      setMetrics(prev => ({ ...prev, scanCount: prev.scanCount + 1, signalCount: prev.signalCount + sigCount, lastAILatency: avgLat }))
      setScanning(false)
    } else {
      // Pre-compute all signals so we can log them before setPairs
      const results = new Map<number, NonNullable<Pair["signal"]> | null>()
      for (const p of activePairs) {
        const sig = makeSignal(p, skillset)
        results.set(p.id, sig.confidence >= threshold ? sig : null)
      }
      const sigCount = Array.from(results.values()).filter(Boolean).length

      setTimeout(() => {
        for (const [pairId, sig] of Array.from(results)) {
          if (!sig) continue
          const p = activePairs.find(ap => ap.id === pairId)!
          logEvent("signal", `${p.sym} ${sig.side} · conf ${sig.confidence}%`)
          setToast({ pair: p, signal: sig })
          setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h].slice(0, 200))
          setUnread(u => u + 1)
          notifSettings.sendSignal({ ...sig, sym: p.sym, digits: p.digits })
        }

        setPairs(prev => prev.map(p => {
          if (!p.active) return p
          const sig = results.get(p.id)
          if (sig) return { ...p, status: "TRADE" as const, signal: sig, lastScan: Date.now(), confidence: sig.confidence }
          const noSig = makeSignal(p, skillset)
          return {
            ...p, status: "NO TRADE" as const, signal: null, lastScan: Date.now(),
            confidence: noSig.confidence, reasoning: noSig.why,
            rsi: p.rsi + (Math.random() - 0.5) * 2,
            macd: p.macd + (Math.random() - 0.5) * 0.01,
          }
        }))

        logEvent("scan", `Scan complete — ${sigCount} signal${sigCount !== 1 ? "s" : ""}`)
        setMetrics(prev => ({ ...prev, scanCount: prev.scanCount + 1, signalCount: prev.signalCount + sigCount }))
        setScanning(false)
      }, 1700)
    }
  }, [skillset, threshold, timeframe, pairs, aiSettings, notifSettings, logEvent])

  useEffect(() => {
    if (secondsLeft === 0 && scannerOn) runScan()
  }, [secondsLeft, scannerOn, runScan])

  // Seed XAU/USD signal on first load
  useEffect(() => {
    if (seededRef.current || pairs.length === 0) return
    seededRef.current = true
    const t = setTimeout(() => {
      setPairs(prev => prev.map(p => {
        if (p.sym !== "XAU/USD") return p
        const sig = {
          side: "SELL" as const, confidence: 82, rr: "3.20", tf: "H1",
          entry: 2342.18, sl: 2358.40, tp1: 2310.50, tp2: 2284.20,
          skillset: "Smart Money Concepts",
          why: "XAU/USD swept liquidity above 2358 daily high then printed bearish BOS at 2342. Retest of breaker block active — sell with invalidation above 2358.40. Confluence: NY session open + USD strength.",
          time: Date.now(),
        }
        setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h])
        return { ...p, status: "TRADE" as const, signal: sig, confidence: 82, reasoning: sig.why, lastScan: Date.now() }
      }))
    }, 1200)
    return () => clearTimeout(t)
  }, [pairs.length])

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

  // Single-pair analysis triggered by zone entry
  const runPairScan = useCallback(async (p: Pair, triggerLabel: string) => {
    const { settings } = aiSettings
    const useAI = settings.useAI && !!settings.apiKeys[settings.activeProvider]
    const isManual = triggerLabel === "Manual"
    logEvent(isManual ? "scan" : "zone", isManual ? `Manual analysis — ${p.sym}` : `Zone entry: ${p.sym} → ${triggerLabel}`)

    let sig: NonNullable<Pair["signal"]> | null = null

    if (useAI) {
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
          }),
        })
        const lat = Date.now() - t0
        if (res.ok) {
          const data = await res.json()
          logEvent("ai", `${p.sym} · ${settings.activeProvider} · ${lat}ms`)
          setMetrics(prev => ({ ...prev, lastAILatency: lat }))
          if (data.side !== "NO TRADE" && data.confidence >= threshold) {
            sig = {
              side: data.side, confidence: data.confidence,
              entry: data.entry, sl: data.sl, tp1: data.tp1, tp2: data.tp2,
              rr: data.rr ?? "2.00", tf: timeframe, skillset,
              why: `[${triggerLabel}] ${data.reasoning}`, time: Date.now(),
            }
          }
        }
      } catch { /* silent */ }
    } else {
      const candidate = makeSignal(p, skillset)
      if (candidate.confidence >= threshold) {
        sig = { ...candidate, why: `[${triggerLabel}] ${candidate.why}` }
      }
    }

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
      else logEvent("sl", `${entry.sym} stop loss hit · ${pnlStr}`)
      setMetrics(prev => ({
        ...prev,
        tpCount: newState !== "SL" ? prev.tpCount + 1 : prev.tpCount,
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

  const toggleKnowledge = (k: string) =>
    setKnowledge(prev => {
      const next = prev.map(x => x.key === k ? { ...x, on: !x.on } : x)
      persSave({ knowledge: Object.fromEntries(next.map(x => [x.key, x.on])) })
      return next
    })

  const onToggleActive = (id: number) =>
    setPairs(prev => {
      const next = prev.map(p => p.id === id ? { ...p, active: !p.active } : p)
      persSave({ activePairIds: next.filter(p => p.active).map(p => p.id) })
      return next
    })

  const handleSetSkillset = (v: string) => { setSkillset(v); persSave({ skillset: v }); logEvent("config", `Skillset → ${v}`) }
  const handleSetThreshold = (v: number) => { setThreshold(v); persSave({ threshold: v }); logEvent("config", `Signal threshold → ${v}%`) }
  const handleSetTimeframe = (v: Timeframe) => { setTimeframe(v); persSave({ timeframe: v }); logEvent("config", `Timeframe → ${v}`) }
  const handleSetScannerOn = (v: boolean) => { setScannerOn(v); persSave({ scannerOn: v }); logEvent("config", v ? "AI Scanner started" : "AI Scanner paused") }

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
        />

        {/* Main content area */}
        {view === "dashboard" && (
          <>
            <ChartPanel pair={selected} timeframe={timeframe} setTimeframe={handleSetTimeframe} />
            <AIPanel
              pair={selected}
              skillset={skillset}
              setSkillset={handleSetSkillset}
              knowledge={knowledge}
              toggleKnowledge={toggleKnowledge}
              history={history}
              threshold={threshold}
              setThreshold={handleSetThreshold}
              scanning={scanning}
              onScanPair={() => runPairScan(selected, "Manual")}
            />
          </>
        )}

        {view === "multichart"   && <MultiChartView pairs={pairs} onOpen={handleOpenPair} />}
        {view === "heatmap"      && <HeatmapView pairs={pairs} />}
        {view === "performance"  && <PerformanceView history={history} />}
        {view === "journal"      && <JournalView history={history} onOpen={setSelectedSignal} />}
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

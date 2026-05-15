"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import NavRail from "./layout/NavRail"
import TopNav from "./layout/TopNav"
import LeftSidebar from "./layout/LeftSidebar"
import ChartPanel from "./chart/ChartPanel"
import AIPanel from "./panels/AIPanel"
import Toast from "./panels/Toast"
import SettingsModal from "./panels/SettingsModal"
import MultiChartView from "./views/MultiChartView"
import HeatmapView from "./views/HeatmapView"
import type { Pair, HistoryEntry, KnowledgeModule, ViewId, Timeframe } from "@/app/lib/types"
import {
  buildInitialState, tickPair, makeSignal, KNOWLEDGE,
  activeSessions, pick, fmt,
} from "@/app/lib/market-data"
import { useAISettings } from "@/app/hooks/useAISettings"

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
  const [secondsLeft, setSecondsLeft] = useState(272)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState<{ pair: Pair; signal: NonNullable<Pair["signal"]> } | null>(null)
  const [view, setView] = useState<ViewId>("dashboard")
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [sessions, setSessions] = useState(activeSessions())
  const [unread, setUnread] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const seededRef = useRef(false)
  const aiSettings = useAISettings()

  useEffect(() => { setPairs(buildInitialState()) }, [])

  useEffect(() => {
    const i = setInterval(() => setPairs(prev => prev.map(tickPair)), 800)
    return () => clearInterval(i)
  }, [])

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

    if (useAI) {
      // AI-powered scan: call each active pair sequentially against the AI provider
      const activePairs = pairs.filter(p => p.active)
      const results: Map<number, NonNullable<Pair["signal"]> | null> = new Map()

      await Promise.allSettled(
        activePairs.map(async p => {
          try {
            const res = await fetch("/api/ai/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: settings.activeProvider,
                model: settings.selectedModels[settings.activeProvider],
                apiKey: settings.apiKeys[settings.activeProvider],
                sym: p.sym, px: p.px, digits: p.digits,
                rsi: p.rsi, macd: p.macd, spread: p.spread,
                history: p.history.slice(-20),
                skillset,
              }),
            })
            if (!res.ok) { results.set(p.id, null); return }
            const data = await res.json()
            if (data.side === "NO TRADE" || data.confidence < threshold) {
              results.set(p.id, null)
            } else {
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

      setPairs(prev => prev.map(p => {
        if (!p.active) return p
        const sig = results.get(p.id)
        if (sig) {
          setToast({ pair: p, signal: sig })
          setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h].slice(0, 80))
          setUnread(u => u + 1)
          return { ...p, status: "TRADE" as const, signal: sig, lastScan: Date.now(), confidence: sig.confidence }
        }
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
      setScanning(false)
    } else {
      // Simulated scan
      setTimeout(() => {
        setPairs(prev => {
          const active = prev.filter(p => p.active)
          const dice = Math.random()
          const winners = dice < 0.55 ? 1 : dice < 0.85 ? 0 : 2
          const chosen = [...active].sort(() => Math.random() - 0.5).slice(0, winners).map(p => p.id)
          return prev.map(p => {
            if (!p.active) return p
            const got = chosen.includes(p.id)
            if (got) {
              const sig = makeSignal(p, skillset)
              if (sig.confidence >= threshold) {
                setToast({ pair: p, signal: sig })
                setHistory(h => [{ sym: p.sym, digits: p.digits, ...sig, state: "ACTIVE" as const }, ...h].slice(0, 80))
                setUnread(u => u + 1)
                return { ...p, status: "TRADE" as const, signal: sig, lastScan: Date.now(), confidence: sig.confidence }
              }
            }
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
          })
        })
        setScanning(false)
      }, 1700)
    }
  }, [skillset, threshold, timeframe, pairs, aiSettings])

  useEffect(() => {
    if (secondsLeft === 0 && scannerOn) runScan()
  }, [secondsLeft, scannerOn, runScan])

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

  const toggleKnowledge = (k: string) =>
    setKnowledge(prev => prev.map(x => x.key === k ? { ...x, on: !x.on } : x))

  const onToggleActive = (id: number) =>
    setPairs(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))

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

  const isFullView = view === "multichart" || view === "heatmap" || view === "performance" || view === "journal" || view === "replay" || view === "system"

  return (
    <div className="flex flex-col h-screen bg-ink-950 overflow-hidden">
      <TopNav
        scannerOn={scannerOn}
        setScannerOn={setScannerOn}
        notifications={unread}
        sessions={sessions}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-1 min-h-0">
        <NavRail
          view={view}
          setView={v => { setView(v); if (v === "journal") setUnread(0) }}
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
        />

        {view === "dashboard" && (
          <>
            <ChartPanel pair={selected} timeframe={timeframe} setTimeframe={setTimeframe} />
            <AIPanel
              pair={selected}
              skillset={skillset}
              setSkillset={setSkillset}
              knowledge={knowledge}
              toggleKnowledge={toggleKnowledge}
              history={history}
              threshold={threshold}
              setThreshold={setThreshold}
              scanning={scanning}
            />
          </>
        )}

        {view === "multichart" && (
          <MultiChartView pairs={pairs} onOpen={handleOpenPair} />
        )}

        {view === "heatmap" && (
          <HeatmapView pairs={pairs} />
        )}

        {(view === "performance" || view === "journal" || view === "replay" || view === "system") && (
          <ComingSoon view={view} />
        )}
      </div>

      <Toast
        signal={toast?.signal ?? null}
        pair={toast?.pair ?? null}
        onDismiss={() => setToast(null)}
        onView={() => { if (toast) { setSelectedId(toast.pair.id); setView("dashboard"); setToast(null) } }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        pairs={pairs}
        onTogglePair={onToggleActive}
        skillset={skillset}
        setSkillset={setSkillset}
        threshold={threshold}
        setThreshold={setThreshold}
        aiSettings={aiSettings}
      />
    </div>
  )
}

function ComingSoon({ view }: { view: ViewId }) {
  const labels: Record<string, string> = {
    performance: "Performance",
    journal: "Signal Journal",
    replay: "Chart Replay",
    system: "System Status",
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-mute">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <div className="text-[15px] text-white/50 font-medium">{labels[view]}</div>
      <div className="text-[12px]">Coming soon — next in development queue</div>
    </div>
  )
}

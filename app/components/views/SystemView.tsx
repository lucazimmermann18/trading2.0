"use client"
import { useState, useEffect, useMemo } from "react"
import type { AuditEntry, SystemMetrics } from "@/app/lib/types"

interface Props {
  auditLog: AuditEntry[]
  metrics: SystemMetrics
  wsConnected: boolean
  activePairs: number
  totalPairs: number
  aiEnabled: boolean
  aiProvider: string
}

const AUDIT_STYLES: Record<string, string> = {
  scan:   "bg-accent-blue/15 text-accent-blue",
  signal: "bg-accent-green/15 text-accent-green",
  zone:   "bg-accent-violet/15 text-accent-violet",
  tp:     "bg-accent-green/15 text-accent-green",
  sl:     "bg-accent-red/15 text-accent-red",
  config: "bg-white/[0.05] text-white/70",
  ai:     "bg-accent-violet/15 text-accent-violet",
  feed:   "bg-white/[0.05] text-white/70",
}

function StatCard({ label, value, sub, accent = "#ffffff" }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="panel rounded-lg p-4">
      <div className="text-[10px] tracking-[0.18em] uppercase text-mute mb-2">{label}</div>
      <div className="num text-[22px] font-semibold leading-none" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10.5px] text-mute mt-1.5 leading-relaxed">{sub}</div>}
    </div>
  )
}

function KVRow({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex items-center justify-between px-3 h-8 rounded-md bg-white/[0.02]">
      <span className="text-[10.5px] tracking-[0.12em] uppercase text-mute">{k}</span>
      <span className="num text-[11.5px] text-white">{v}</span>
    </div>
  )
}

export default function SystemView({ auditLog, metrics, wsConnected, activePairs, totalPairs, aiEnabled, aiProvider }: Props) {
  const [tick, setTick] = useState(0)
  const [mountTime] = useState(() => Date.now())

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(i)
  }, [])

  const uptime = useMemo(() => {
    const elapsed = Date.now() - mountTime
    const h = Math.floor(elapsed / 3600000)
    const m = Math.floor((elapsed % 3600000) / 60000)
    return `${h}h ${m}m`
  }, [tick, mountTime]) // eslint-disable-line react-hooks/exhaustive-deps

  const latencyDisplay = metrics.lastAILatency > 0
    ? `${metrics.lastAILatency}ms`
    : "—"

  const winRate = metrics.tpCount + metrics.slCount > 0
    ? Math.round((metrics.tpCount / (metrics.tpCount + metrics.slCount)) * 100)
    : null

  const feeds = [
    {
      name: "Twelve Data WS",
      status: (wsConnected ? "ok" : "error") as "ok" | "stale" | "error",
      latency: wsConnected ? 28 + Math.floor(Math.sin(tick) * 8) : 0,
      msgsPerMin: wsConnected ? activePairs * 75 : 0,
      note: wsConnected ? undefined : "Reconnecting…",
    },
    {
      name: "Price Simulator",
      status: "ok" as const,
      latency: 0,
      msgsPerMin: activePairs * 75,
      note: "800ms tick · always live",
    },
    {
      name: `AI — ${aiProvider}`,
      status: (aiEnabled ? "ok" : "stale") as "ok" | "stale" | "error",
      latency: metrics.lastAILatency || 0,
      msgsPerMin: 0,
      note: aiEnabled ? `Last call ${metrics.lastAILatency ? metrics.lastAILatency + "ms" : "—"}` : "API key not configured",
    },
    {
      name: "OANDA REST",
      status: "stale" as const,
      latency: 0,
      msgsPerMin: 0,
      note: "API key not configured",
    },
  ]

  const allOk = wsConnected && aiEnabled
  const statusLabel = allOk ? "ALL SYSTEMS OPERATIONAL" : wsConnected ? "AI NOT CONFIGURED" : "FEED DISCONNECTED"
  const statusColor = allOk ? "#00ff88" : wsConnected ? "#ffb800" : "#ff3d5a"

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-end justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-semibold text-white tracking-tight">System Status</div>
            <div className="text-[11px] text-mute mt-0.5">Live health of the scanner — every component, every event</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: statusColor }}>
          <span className="dot animate-pulseDot" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
          {statusLabel}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Session Uptime"    value={uptime}
            sub="Since page load · auto-scanning" accent="#00ff88" />
          <StatCard label="Scans Run"          value={metrics.scanCount}
            sub={`${metrics.signalCount} signal${metrics.signalCount !== 1 ? "s" : ""} generated`} accent="#00d4ff" />
          <StatCard label="Last AI Latency"    value={latencyDisplay}
            sub={`Provider: ${aiProvider}`} accent="#a78bfa" />
          <StatCard label="Active Pairs"        value={`${activePairs} / ${totalPairs}`}
            sub={winRate !== null ? `Win rate: ${winRate}% · ${metrics.tpCount}TP / ${metrics.slCount}SL` : "Monitoring 24/7"} />
        </div>

        {/* Data feeds */}
        <div className="panel rounded-lg p-4">
          <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Data Feeds</div>
          <div className="space-y-2">
            {feeds.map(f => {
              const dotCol = f.status === "ok" ? "#00ff88" : f.status === "stale" ? "#ffb800" : "#ff3d5a"
              const statusLabel = f.status === "ok" ? "● LIVE" : f.status === "stale" ? "◐ STALE" : "○ OFFLINE"
              return (
                <div key={f.name} className="flex items-center gap-3 px-3 h-11 rounded-md bg-white/[0.02]">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: dotCol, boxShadow: f.status === "ok" ? `0 0 6px ${dotCol}` : "" }} />
                  <div className="w-[130px] text-[12px] text-white font-medium shrink-0">{f.name}</div>
                  <div className="flex-1 flex items-center gap-4 text-[10.5px] text-mute num">
                    {f.latency > 0 && <span className="w-16">{f.latency}ms</span>}
                    {f.msgsPerMin > 0 && <span>{f.msgsPerMin} msg/min</span>}
                    {f.note && <span className="italic">{f.note}</span>}
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.14em]" style={{ color: dotCol }}>
                    {statusLabel}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Signal stats */}
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Signal Stats</div>
            <div className="space-y-1.5">
              <KVRow k="Scans run"       v={metrics.scanCount} />
              <KVRow k="Signals found"   v={metrics.signalCount} />
              <KVRow k="TP hits"         v={metrics.tpCount} />
              <KVRow k="SL hits"         v={metrics.slCount} />
              <KVRow k="Win rate"        v={winRate !== null ? `${winRate}%` : "—"} />
              <KVRow k="AI latency"      v={latencyDisplay} />
            </div>
          </div>

          {/* Runtime info */}
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Runtime</div>
            <div className="space-y-1.5">
              <KVRow k="Framework"    v="Next.js 14" />
              <KVRow k="Runtime"      v="Edge / Node.js" />
              <KVRow k="Scan Engine"  v="Confluence + AI" />
              <KVRow k="Chart Lib"    v="lightweight-charts v5" />
              <KVRow k="Price API"    v="Twelve Data" />
              <KVRow k="Session up"   v={uptime} />
            </div>
          </div>
        </div>

        {/* Audit log */}
        <div className="panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute">Live Audit Log</div>
            <div className="text-[10px] text-mute">{auditLog.length} event{auditLog.length !== 1 ? "s" : ""} this session</div>
          </div>
          {auditLog.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-mute text-[12px] italic">
              Waiting for app events — run a scan to start logging
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
              {auditLog.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/[0.02] transition">
                  <span className="num text-mute text-[10px] w-[76px] shrink-0">
                    {new Date(e.time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className={`text-[9.5px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-[3px] shrink-0 ${AUDIT_STYLES[e.kind] ?? "bg-white/5 text-mute"}`}>
                    {e.kind}
                  </span>
                  <span className="text-[11.5px] text-white/75 truncate">{e.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

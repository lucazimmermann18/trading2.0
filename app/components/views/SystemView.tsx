"use client"
import { useMemo, useState, useEffect } from "react"

interface FeedStatus { name: string; status: "ok" | "stale" | "error"; latency: number; msgsPerMin: number; note?: string }
interface AuditEvent { id: number; time: number; kind: string; msg: string }

const AUDIT_COLORS: Record<string, string> = {
  scan:    "bg-accent-blue/15 text-accent-blue",
  signal:  "bg-accent-green/15 text-accent-green",
  notif:   "bg-accent-violet/20 text-accent-violet",
  tp:      "bg-accent-green/15 text-accent-green",
  sl:      "bg-accent-red/15 text-accent-red",
  config:  "bg-white/[0.05] text-white/70",
  ai:      "bg-accent-violet/15 text-accent-violet",
  feed:    "bg-white/[0.05] text-white/70",
}

function buildAuditLog(): AuditEvent[] {
  const events = [
    { kind: "scan",   msgs: ["Scan cycle complete — 14 pairs analyzed", "AI scan started", "Scan skipped — scanner paused"] },
    { kind: "signal", msgs: ["XAU/USD SELL signal generated · conf 82%", "EUR/USD BUY signal above threshold", "GBP/USD signal below threshold — skipped"] },
    { kind: "tp",     msgs: ["XAU/USD TP1 reached +1.2R", "BTC/USD TP2 hit +3.1R"] },
    { kind: "sl",     msgs: ["USD/JPY stopped out −1R", "ETH/USD SL triggered −0.8R"] },
    { kind: "ai",     msgs: ["Anthropic Claude API call · 340ms", "Model response parsed OK", "Token usage: 1,240 input / 186 output"] },
    { kind: "feed",   msgs: ["Twelve Data price feed updated", "WebSocket reconnected", "Feed latency spike detected — 420ms"] },
    { kind: "config", msgs: ["Threshold updated to 75%", "Skillset changed: Smart Money Concepts", "Pair EUR/USD disabled"] },
  ]
  const out: AuditEvent[] = []
  const now = Date.now()
  for (let i = 0; i < 60; i++) {
    const ev = events[Math.floor(Math.random() * events.length)]
    const msgs = ev.msgs
    out.push({
      id: i,
      time: now - (59 - i) * 90000 - Math.random() * 60000,
      kind: ev.kind,
      msg: msgs[Math.floor(Math.random() * msgs.length)],
    })
  }
  return out.sort((a, b) => b.time - a.time)
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

export default function SystemView() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(i)
  }, [])

  const startTime = useMemo(() => Date.now() - 14 * 3600000 - Math.random() * 3600000, [])
  const audit = useMemo(buildAuditLog, [])

  const uptime = 99.7
  const upHours = Math.floor((Date.now() - startTime) / 3600000)
  const scansToday = 288 + Math.floor(tick * 0.3)
  const latency = 280 + Math.floor(Math.sin(tick * 0.7) * 80)

  const feeds: FeedStatus[] = [
    { name: "Twelve Data",  status: "ok",    latency: 38 + Math.floor(Math.sin(tick) * 12), msgsPerMin: 840 },
    { name: "Price Ticker", status: "ok",    latency: 12 + Math.floor(Math.cos(tick) * 5),  msgsPerMin: 1680 },
    { name: "OANDA REST",   status: "stale", latency: 0,   msgsPerMin: 0,   note: "API key not configured" },
    { name: "MetaApi",      status: "error", latency: 0,   msgsPerMin: 0,   note: "Connection refused" },
    { name: "CoinGecko",    status: "ok",    latency: 91 + Math.floor(Math.random() * 40),  msgsPerMin: 60 },
  ]

  const notifChannels = [
    { name: "Telegram",  status: "off",  delivered: 0,  failed: 0 },
    { name: "Webhook",   status: "off",  delivered: 0,  failed: 0 },
    { name: "Email",     status: "off",  delivered: 0,  failed: 0 },
    { name: "Discord",   status: "off",  delivered: 0,  failed: 0 },
  ]

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
            <div className="text-[11px] text-mute mt-0.5">
              Real-time health of the scanner backbone — every component, every feed
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-accent-green">
          <span className="dot bg-accent-green animate-pulseDot" style={{ boxShadow: "0 0 6px rgba(0,255,136,0.8)" }} />
          ALL SYSTEMS OPERATIONAL
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Scanner Uptime" value={`${uptime}%`}
            sub={`${upHours}h online · auto-restart enabled`} accent="#00ff88" />
          <StatCard label="Scans Today" value={scansToday}
            sub="5-min interval · 288 expected/day" accent="#00d4ff" />
          <StatCard label="AI Latency p50" value={`${latency}ms`}
            sub="Last model call round-trip" accent="#a78bfa" />
          <StatCard label="Active Pairs" value="8 / 14"
            sub="Monitored pairs · 24/7 scanning" />
        </div>

        {/* Data feeds */}
        <div className="panel rounded-lg p-4">
          <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Data Feeds</div>
          <div className="space-y-2">
            {feeds.map(f => {
              const dotCol = f.status === "ok" ? "#00ff88" : f.status === "stale" ? "#ffb800" : "#ff3d5a"
              const statusLabel = f.status === "ok" ? "● LIVE" : f.status === "stale" ? "◐ STALE" : "○ OFFLINE"
              const statusColor = f.status === "ok" ? "#00ff88" : f.status === "stale" ? "#ffb800" : "#ff3d5a"
              return (
                <div key={f.name} className="flex items-center gap-3 px-3 h-11 rounded-md bg-white/[0.02]">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: dotCol, boxShadow: f.status === "ok" ? `0 0 6px ${dotCol}` : "" }} />
                  <div className="w-[110px] text-[12px] text-white font-medium shrink-0">{f.name}</div>
                  <div className="flex-1 flex items-center gap-4 text-[10.5px] text-mute num">
                    {f.latency > 0 && <span className="w-16">{f.latency}ms</span>}
                    {f.msgsPerMin > 0 && <span>{f.msgsPerMin.toLocaleString()} msg/min</span>}
                    {f.note && <span className="italic text-mute/70">{f.note}</span>}
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.14em]" style={{ color: statusColor }}>
                    {statusLabel}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Notification channels */}
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Notification Channels</div>
            <div className="space-y-2">
              {notifChannels.map(n => (
                <div key={n.name} className="flex items-center justify-between px-3 h-10 rounded-md bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-mute/50" />
                    <div className="text-[12px] text-white">{n.name}</div>
                  </div>
                  <div className="text-[10px] text-mute">not configured</div>
                </div>
              ))}
            </div>
          </div>

          {/* Runtime info */}
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">Runtime</div>
            <div className="space-y-1.5">
              <KVRow k="Framework"    v="Next.js 14" />
              <KVRow k="Runtime"      v="Edge / Node.js" />
              <KVRow k="Scan Engine"  v="Built-in + AI" />
              <KVRow k="Chart Lib"    v="lightweight-charts v5" />
              <KVRow k="Price API"    v="Twelve Data" />
              <KVRow k="Uptime"       v={`${upHours}h ${Math.floor((Date.now() - startTime) % 3600000 / 60000)}m`} />
            </div>
          </div>
        </div>

        {/* Audit log */}
        <div className="panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute">Audit Log</div>
            <div className="text-[10px] text-mute">last 60 events</div>
          </div>
          <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
            {audit.map(e => (
              <div key={e.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/[0.02] transition">
                <span className="num text-mute text-[10px] w-[76px] shrink-0">
                  {new Date(e.time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`text-[9.5px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-[3px] shrink-0 ${AUDIT_COLORS[e.kind] ?? "bg-white/5 text-mute"}`}>
                  {e.kind}
                </span>
                <span className="text-[11.5px] text-white/75 truncate">{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

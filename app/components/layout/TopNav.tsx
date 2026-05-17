"use client"
import type { Session } from "@/app/lib/types"

interface Props {
  scannerOn: boolean
  setScannerOn: (v: boolean) => void
  notifications: number
  sessions: Session[]
  onOpenSettings: () => void
  wsConnected?: boolean
}

export default function TopNav({ scannerOn, setScannerOn, notifications, sessions, onOpenSettings, wsConnected }: Props) {
  return (
    <div className="h-[52px] md:h-[60px] flex items-center px-3 md:px-5 panel border-l-0 border-r-0 border-t-0 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 md:gap-2.5 md:w-[260px] shrink-0">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M4 22 12 10l5 7 4-5 7 10" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="17" cy="17" r="2.4" fill="#00ff88"/>
        </svg>
        <div className="leading-tight">
          <div className="text-[14px] md:text-[15px] font-semibold tracking-tight text-white">
            TradeAI <span className="text-accent-blue">Pro</span>
          </div>
          <div className="hidden md:block text-[10px] text-mute tracking-[0.18em] uppercase">Institutional Signal Engine</div>
        </div>
      </div>

      {/* Sessions - desktop only */}
      <div className="hidden md:flex flex-1 items-center justify-center">
        <div className="flex items-center gap-1 px-1 py-1 rounded-md glass">
          {sessions.map(s => (
            <div
              key={s.key}
              className={`flex items-center gap-2 px-3 h-8 rounded-md transition ${s.active ? "bg-white/[0.05] text-white" : "text-mute"}`}
            >
              <span
                className={`dot ${s.active ? "bg-accent-green animate-pulseDot" : "bg-mute/60"}`}
                style={s.active ? { boxShadow: "0 0 8px rgba(0,255,136,0.6)" } : {}}
              />
              <span className="text-[11px] font-medium tracking-[0.14em]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: active session dot */}
      <div className="md:hidden flex-1 flex items-center px-2">
        {sessions.some(s => s.active) && (
          <div className="flex items-center gap-1.5 text-[10px] text-accent-green">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulseDot" style={{ boxShadow: "0 0 6px rgba(0,255,136,0.8)" }} />
            {sessions.filter(s => s.active).map(s => s.label).join("/")}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* WebSocket indicator - desktop only */}
        <div className={`hidden md:flex h-7 px-2.5 rounded-md items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] border transition
          ${wsConnected
            ? "border-accent-blue/30 text-accent-blue bg-accent-blue/[0.06]"
            : "border-white/[0.06] text-mute"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-accent-blue animate-pulseDot" : "bg-white/20"}`}
            style={wsConnected ? { boxShadow: "0 0 6px rgba(0,212,255,0.8)" } : {}} />
          {wsConnected ? "WS LIVE" : "WS OFF"}
        </div>

        {/* Mobile: WS dot only */}
        <div className="md:hidden">
          <span className={`w-2 h-2 rounded-full block ${wsConnected ? "bg-accent-blue animate-pulseDot" : "bg-white/20"}`}
            style={wsConnected ? { boxShadow: "0 0 6px rgba(0,212,255,0.8)" } : {}} />
        </div>

        <button
          onClick={() => setScannerOn(!scannerOn)}
          className={`h-8 px-2 md:px-3 rounded-md flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-semibold tracking-[0.12em] md:tracking-[0.14em] transition
            ${scannerOn
              ? "bg-accent-green/10 text-accent-green border border-accent-green/40"
              : "btn-ghost text-mute border border-transparent"}`}
        >
          <span
            className={`dot ${scannerOn ? "bg-accent-green animate-pulseDot" : "bg-mute"}`}
            style={scannerOn ? { boxShadow: "0 0 6px rgba(0,255,136,0.8)" } : {}}
          />
          <span className="hidden sm:inline">SCANNER </span>
          {scannerOn ? "ON" : "OFF"}
        </button>

        <button className="relative w-9 h-9 rounded-md btn-ghost flex items-center justify-center text-mute hover:text-white">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent-red text-[10px] font-bold text-white flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-md btn-ghost flex items-center justify-center text-mute hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
          </svg>
        </button>

        <div className="hidden md:flex w-9 h-9 rounded-md btn-ghost items-center justify-center text-mute">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

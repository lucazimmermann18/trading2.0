"use client"
import { useState, useMemo, useEffect } from "react"
import type { Pair, HistoryEntry, Signal, ConfluenceItem } from "@/app/lib/types"
import { fmt, timeAgo } from "@/app/lib/market-data"
import { buildSMCContext } from "@/app/lib/smc"

const SIZER_KEY = "tradeai_sizer_v1"

function loadSizerPrefs(): { account: string; riskPct: string } {
  if (typeof window === "undefined") return { account: "10000", riskPct: "1" }
  try {
    const raw = localStorage.getItem(SIZER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { account: "10000", riskPct: "1" }
}

function PositionSizer({ pair }: { pair: Pair }) {
  const [prefs, setPrefs] = useState(loadSizerPrefs)

  const persist = (patch: Partial<typeof prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(SIZER_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const signal = pair.signal
  const account = parseFloat(prefs.account) || 0
  const riskPct = Math.min(10, Math.max(0.1, parseFloat(prefs.riskPct) || 1))
  const dollarRisk = account * (riskPct / 100)

  // pip size: JPY pairs = 0.01, others = 0.0001 (crypto/indices handled by digits)
  const pipSize = pair.digits <= 2 ? 0.01 : pair.digits <= 3 ? 0.001 : 0.0001
  const slDistance = signal ? Math.abs(signal.entry - signal.sl) : 0
  const slPips = slDistance > 0 ? slDistance / pipSize : 0
  // Standard lot pip value ≈ $10 for USD-quoted pairs, approximate for others
  const pipValue = 10
  const lots = slPips > 0 ? dollarRisk / (slPips * pipValue) : 0
  const miniLots = lots * 10
  const microLots = lots * 100

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9.5px] tracking-[0.14em] text-mute mb-1.5 uppercase">Account ($)</div>
          <input
            type="number"
            min="100" step="100"
            value={prefs.account}
            onChange={e => persist({ account: e.target.value })}
            className="w-full h-8 px-2 rounded-md bg-white/[0.025] border border-white/[0.06] text-[12px] text-white outline-none focus:border-accent-blue/40 num transition"
          />
        </div>
        <div>
          <div className="text-[9.5px] tracking-[0.14em] text-mute mb-1.5 uppercase">Risk %</div>
          <input
            type="number"
            min="0.1" max="10" step="0.1"
            value={prefs.riskPct}
            onChange={e => persist({ riskPct: e.target.value })}
            className="w-full h-8 px-2 rounded-md bg-white/[0.025] border border-white/[0.06] text-[12px] text-white outline-none focus:border-accent-blue/40 num transition"
          />
        </div>
      </div>

      {/* Results */}
      <div className="rounded-md p-2.5 bg-white/[0.025] border border-white/[0.05] space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-mute tracking-[0.12em]">$ at risk</span>
          <span className="num font-semibold text-accent-red">${dollarRisk.toFixed(2)}</span>
        </div>
        {signal && slPips > 0 ? (
          <>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-mute tracking-[0.12em]">SL distance</span>
              <span className="num text-white">{slPips.toFixed(1)} pips</span>
            </div>
            <div className="h-px bg-white/[0.06] my-0.5" />
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-mute tracking-[0.12em]">Standard lots</span>
              <span className="num font-bold text-accent-blue">{lots.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-mute tracking-[0.12em]">Mini lots</span>
              <span className="num text-white/70">{miniLots.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-mute tracking-[0.12em]">Micro lots</span>
              <span className="num text-white/70">{microLots.toFixed(0)}</span>
            </div>
          </>
        ) : (
          <div className="text-[10px] text-mute/60 italic">Active signal required for lot calculation</div>
        )}
      </div>
    </div>
  )
}

interface Props {
  pair: Pair
  history: HistoryEntry[]
  threshold: number
  setThreshold: (n: number) => void
  scanning: boolean
  onScanPair: () => Promise<void>
  aiConfigured: boolean
}

function Section({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 md:py-3.5 border-b hairline">
      <div className="flex items-center justify-between mb-2 md:mb-2.5">
        <div className="text-[10.5px] md:text-[10px] tracking-[0.18em] uppercase text-mute font-medium">{label}</div>
        {sub && <div className="text-[10px] text-mute">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function KV({ label, v, color }: { label: string; v: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-2 md:py-1.5 rounded-md bg-white/[0.025]">
      <span className="text-mute text-[10.5px] md:text-[10px] tracking-[0.14em]">{label}</span>
      <span className="num text-[11px]" style={{ color }}>{v}</span>
    </div>
  )
}

/* ── Signal Timer: age + expiry countdown ────────────────── */
function SignalTimer({ signal }: { signal: Signal }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const expiresAt = signal.expiresAt ?? signal.time + 8 * 3_600_000
  const age       = now - signal.time
  const total     = expiresAt - signal.time
  const remaining = expiresAt - now
  const pct       = Math.min(100, Math.max(0, (age / total) * 100))
  const expired   = remaining <= 0

  const dur = (ms: number) => {
    const abs = Math.abs(ms)
    const h = Math.floor(abs / 3_600_000)
    const m = Math.floor((abs % 3_600_000) / 60_000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const barCol = pct < 50 ? "#00ff88" : pct < 80 ? "#ffb800" : "#ff3d5a"

  return (
    <div className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-mute tracking-[0.12em] uppercase">Signal Age</span>
        <span className="num text-white/80">{dur(age)} ago</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: barCol, boxShadow: `0 0 8px ${barCol}55` }}
        />
        {/* 50% marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-mute tracking-[0.12em] uppercase">Expires</span>
        {expired ? (
          <span className="text-accent-red font-bold tracking-[0.14em] animate-pulse">EXPIRED</span>
        ) : (
          <span className="num font-semibold" style={{ color: barCol }}>in {dur(remaining)}</span>
        )}
      </div>
    </div>
  )
}

/* ── Confluence Checklist ─────────────────────────────────── */
function ConfluenceChecklist({ confluences }: { confluences: ConfluenceItem[] }) {
  const metCount  = confluences.filter(c => c.met).length
  const total     = confluences.length
  const scoreCol  = metCount >= 6 ? "#00ff88" : metCount >= 4 ? "#ffb800" : "#ff3d5a"

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] tracking-[0.16em] uppercase text-mute">Confluence Score</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(metCount / total) * 100}%`, background: scoreCol }} />
          </div>
          <span className="num text-[11px] font-bold" style={{ color: scoreCol }}>{metCount}/{total}</span>
        </div>
      </div>
      <div className="space-y-0.5">
        {confluences.map((c, i) => (
          <div key={i} className={`flex items-start gap-2 px-2 py-1.5 rounded-md transition-opacity ${c.met ? "" : "opacity-35"}`}>
            <span className={`text-[11px] font-bold mt-px w-3.5 shrink-0 ${c.met ? "text-accent-green" : "text-white/30"}`}>
              {c.met ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`text-[10.5px] leading-none ${c.met ? "text-white/90" : "text-white/45"}`}>{c.label}</span>
              {c.met && c.detail && (
                <div className="text-[9px] text-mute/70 mt-0.5 num truncate">{c.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AIPanel({ pair, history, threshold, setThreshold, scanning, onScanPair, aiConfigured }: Props) {
  const [manualScanning, setManualScanning] = useState(false)
  const trade = pair.status === "TRADE"
  const conf = pair.signal?.confidence ?? pair.confidence ?? 0
  const confCol = conf >= 70 ? "#00ff88" : conf >= 40 ? "#ffb800" : "#ff3d5a"
  const isScanning = scanning || manualScanning

  const smc = useMemo(
    () => pair.history.length >= 20 ? buildSMCContext(pair.history, pair.px) : null,
    [pair.history, pair.px]
  )

  const handleManualScan = async () => {
    if (isScanning) return
    setManualScanning(true)
    try { await onScanPair() } finally { setManualScanning(false) }
  }

  const biasCol = smc?.structure.bias === "BULLISH" ? "#00ff88"
    : smc?.structure.bias === "BEARISH" ? "#ff3d5a" : "#ffffff40"
  const zoneCol = smc?.structure.zone === "DISCOUNT" ? "#00ff88"
    : smc?.structure.zone === "PREMIUM" ? "#ff3d5a" : "#ffffff50"

  return (
    <aside className="w-full md:w-[320px] shrink-0 panel border-t-0 border-b-0 border-r-0 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b hairline shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-[0.18em] uppercase text-mute">AI Analysis Engine</div>
          <div className="flex items-center gap-1.5 text-[10px] text-accent-blue">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-pulseDot">
              <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1"/>
            </svg>
            <span className="tracking-[0.14em]">LIVE SMC</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="text-[15px] md:text-[14px] text-white font-semibold tracking-tight">{pair.sym}</div>
          <span className={`px-2 h-5 rounded text-[10px] md:text-[9px] font-bold tracking-[0.16em] flex items-center
            ${trade ? "bg-accent-green/15 text-accent-green" : "bg-white/[0.04] text-mute"}`}>
            {trade ? "TRADE" : "NO TRADE"}
          </span>
        </div>
      </div>

      {/* Scan button */}
      <div className="px-4 py-3 border-b hairline shrink-0">
        {aiConfigured ? (
          <button
            onClick={handleManualScan}
            disabled={isScanning}
            className={`w-full h-11 md:h-9 rounded-md flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.18em] transition
              ${isScanning
                ? "bg-accent-blue/10 text-accent-blue/50 cursor-not-allowed"
                : "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 active:scale-[0.98]"}`}
            style={{ boxShadow: isScanning ? "none" : "inset 0 0 0 1px rgba(0,212,255,0.25)" }}
          >
            {isScanning ? (
              <>
                <svg className="animate-spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                ANALYSING…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                </svg>
                ANALYSE NOW
              </>
            )}
          </button>
        ) : (
          <div className="w-full rounded-md flex flex-col items-center justify-center gap-1.5 p-3 bg-accent-violet/5 border border-accent-violet/20">
            <div className="flex items-center gap-2 text-accent-violet">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01"/>
              </svg>
              <span className="text-[11px] font-bold tracking-[0.16em]">AI KEY REQUIRED</span>
            </div>
            <span className="text-[10px] text-mute text-center leading-relaxed">
              Configure your API key in Settings to enable AI analysis
            </span>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {/* AI Auto-Analysis */}
        <Section label="AI Auto-Analysis">
          <div className="px-3 py-2.5 rounded-lg bg-accent-blue/[0.06] border border-accent-blue/[0.12] space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-[11px] font-semibold text-accent-blue tracking-[0.1em]">AUTONOMOUS MODE</span>
            </div>
            <p className="text-[10.5px] text-white/60 leading-relaxed">
              The AI reads the full market structure and picks the best approach — SMC, trend, breakout, or reversal — for each scan. No manual strategy needed.
            </p>
          </div>
        </Section>

        {/* Live SMC Market Structure */}
        <Section label="Market Structure" sub={smc ? "Live" : "Loading…"}>
          {!smc ? (
            <div className="text-[11px] text-mute italic">Waiting for market data…</div>
          ) : (
            <div className="space-y-2">
              {/* Bias + Zone row */}
              <div className="flex items-center gap-2">
                <span className="px-2 h-[22px] rounded text-[10px] font-bold tracking-[0.12em] flex items-center"
                  style={{ background: `${biasCol}18`, color: biasCol }}>
                  {smc.structure.bias}
                </span>
                <span className="px-2 h-[22px] rounded text-[10px] font-semibold tracking-[0.1em] flex items-center"
                  style={{ background: `${zoneCol}12`, color: zoneCol }}>
                  {smc.structure.zone}
                </span>
                {smc.structure.inOTE && (
                  <span className="px-2 h-[22px] rounded bg-accent-violet/15 text-accent-violet text-[10px] font-bold tracking-[0.1em] flex items-center">
                    OTE ★
                  </span>
                )}
              </div>

              {/* BOS / CHoCH */}
              {smc.structure.lastBOS && (
                <div className="flex items-center justify-between px-2 py-1 rounded-md bg-white/[0.02]">
                  <span className="text-[10px] font-bold tracking-[0.1em]"
                    style={{ color: smc.structure.lastBOS.direction === "UP" ? "#00ff88" : "#ff3d5a" }}>
                    {smc.structure.lastBOS.kind} {smc.structure.lastBOS.direction === "UP" ? "↑" : "↓"}
                  </span>
                  <span className="num text-[10px] text-white">{smc.structure.lastBOS.price.toFixed(pair.digits)}</span>
                </div>
              )}

              {/* Liquidity Sweeps — highest priority setup */}
              {smc.sweeps?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-[0.16em] uppercase px-1 pt-1 text-accent-yellow font-bold">⚡ Liquidity Sweeps</div>
                  {smc.sweeps.slice(0, 2).map((sw, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                      style={{ background: sw.type === "bull" ? "rgba(0,255,136,0.06)" : "rgba(255,61,90,0.06)", border: `1px solid ${sw.type === "bull" ? "rgba(0,255,136,0.2)" : "rgba(255,61,90,0.2)"}` }}>
                      <span className={`text-[10px] font-bold w-[28px] shrink-0 ${sw.type === "bull" ? "text-accent-green" : "text-accent-red"}`}>
                        {sw.type === "bull" ? "↑ SS" : "↓ BS"}
                      </span>
                      <span className="num text-[10px] text-white flex-1">{sw.level.toFixed(pair.digits)}</span>
                      <span className="text-[9px] text-mute shrink-0">{sw.barsAgo}B ago</span>
                      <span className="text-[9px] shrink-0" style={{ color: sw.type === "bull" ? "#00ff88" : "#ff3d5a" }}>{"●".repeat(sw.strength)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* RSI Divergence */}
              {smc.divergence && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent-violet/10 border border-accent-violet/20">
                  <span className="text-[9px] font-bold tracking-[0.12em] text-accent-violet">RSI DIV</span>
                  <span className={`text-[10px] font-semibold flex-1 ${smc.divergence.type === "bullish" ? "text-accent-green" : "text-accent-red"}`}>
                    {smc.divergence.type === "bullish" ? "↑ Bullish" : "↓ Bearish"} divergence
                  </span>
                </div>
              )}

              {/* H4 Order Blocks */}
              {smc.h4OrderBlocks?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-[0.16em] uppercase text-mute/70 px-1 pt-1">H4 Order Blocks <span className="text-accent-blue/60">(strong)</span></div>
                  {smc.h4OrderBlocks.slice(0, 2).map((ob, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                      <span className={`text-[10px] font-bold w-[28px] shrink-0 ${ob.type === "bull" ? "text-accent-green" : "text-accent-red"}`}>
                        {ob.type === "bull" ? "↑ H4" : "↓ H4"}
                      </span>
                      <span className="num text-[10px] text-white flex-1 truncate">
                        {ob.low.toFixed(pair.digits)} – {ob.high.toFixed(pair.digits)}
                      </span>
                      <span className="text-[9px] text-accent-blue/70 shrink-0">{"●".repeat(ob.strength)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* H1 Order Blocks */}
              {smc.orderBlocks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-[0.16em] uppercase text-mute/70 px-1 pt-1">H1 Order Blocks</div>
                  {smc.orderBlocks.slice(0, 2).map((ob, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02]">
                      <span className={`text-[10px] font-bold w-[28px] shrink-0 ${ob.type === "bull" ? "text-accent-green" : "text-accent-red"}`}>
                        {ob.type === "bull" ? "↑ H1" : "↓ H1"}
                      </span>
                      <span className="num text-[10px] text-white flex-1 truncate">
                        {ob.low.toFixed(pair.digits)} – {ob.high.toFixed(pair.digits)}
                      </span>
                      <span className="text-[9px] text-accent-blue/70 shrink-0">{"●".repeat(ob.strength)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Fair Value Gaps */}
              {smc.fvgs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-[0.16em] uppercase text-mute/70 px-1 pt-1">Fair Value Gaps</div>
                  {smc.fvgs.slice(0, 2).map((fvg, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02]">
                      <span className={`text-[10px] font-bold w-[28px] shrink-0 ${fvg.type === "bull" ? "text-accent-blue" : "text-accent-violet"}`}>
                        {fvg.type === "bull" ? "↑ G" : "↓ G"}
                      </span>
                      <span className="num text-[10px] text-white flex-1 truncate">
                        {fvg.bottom.toFixed(pair.digits)} – {fvg.top.toFixed(pair.digits)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Liquidity Levels + PDH/PDL */}
              {(smc.liquidity.length > 0 || smc.daily) && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-[0.16em] uppercase text-mute/70 px-1 pt-1">Key Levels</div>
                  {smc.daily && (
                    <>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02]">
                        <span className="text-[9.5px] font-bold w-[28px] shrink-0 text-accent-yellow/80">PDH</span>
                        <span className="num text-[10px] text-white flex-1">{smc.daily.pdHigh.toFixed(pair.digits)}</span>
                        <span className="text-[9px] text-mute">prev day</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02]">
                        <span className="text-[9.5px] font-bold w-[28px] shrink-0 text-accent-yellow/80">PDL</span>
                        <span className="num text-[10px] text-white flex-1">{smc.daily.pdLow.toFixed(pair.digits)}</span>
                        <span className="text-[9px] text-mute">prev day</span>
                      </div>
                    </>
                  )}
                  {smc.liquidity.slice(0, 2).map((liq, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02]">
                      <span className={`text-[9.5px] font-bold w-[28px] shrink-0 ${liq.type === "buyside" ? "text-accent-green/70" : "text-accent-red/70"}`}>
                        {liq.type === "buyside" ? "BSL" : "SSL"}
                      </span>
                      <span className="num text-[10px] text-white flex-1">{liq.price.toFixed(pair.digits)}</span>
                      <span className="text-[9px] text-mute shrink-0">{liq.touches}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Active Signal — timer + levels + confluence breakdown */}
        {trade && pair.signal ? (
          <Section label="Active Signal" sub={timeAgo(pair.lastScan)}>
            <div className="space-y-3">
              {/* Signal timer / expiry */}
              <SignalTimer signal={pair.signal} />

              {/* Entry / SL / TP levels */}
              <div className="grid grid-cols-2 gap-1.5">
                <KV label="Entry" v={fmt(pair.signal.entry, pair.digits)} color="#00d4ff"/>
                <KV label="SL"    v={fmt(pair.signal.sl,    pair.digits)} color="#ff3d5a"/>
                <KV label="TP1"   v={fmt(pair.signal.tp1,   pair.digits)} color="#00ff88"/>
                <KV label="TP2"   v={fmt(pair.signal.tp2,   pair.digits)} color="#00ff88"/>
              </div>

              {/* AI reasoning */}
              <div className="rounded-md p-2.5 bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[10px] text-white/75 leading-relaxed">{pair.signal.why}</div>
              </div>

              {/* Confluence breakdown */}
              {pair.signal.confluences && pair.signal.confluences.length > 0 && (
                <div className="rounded-md p-2.5 bg-white/[0.02] border border-white/[0.05]">
                  <ConfluenceChecklist confluences={pair.signal.confluences} />
                </div>
              )}
            </div>
          </Section>
        ) : (
          <Section label="Last AI Scan" sub={timeAgo(pair.lastScan)}>
            <div className="rounded-lg p-3 bg-white/[0.025] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] tracking-[0.14em] text-mute">{pair.sym} · {pair.signal?.tf ?? "H1"}</div>
                {pair.lastScan > 0 && <div className="text-[10px] num text-mute">{new Date(pair.lastScan).toLocaleTimeString()}</div>}
              </div>
              <div className="text-[12px] leading-relaxed text-white/85">{pair.reasoning}</div>
            </div>
          </Section>
        )}

        {/* Position Sizing */}
        <Section label="Position Sizer" sub="Risk calculator">
          <PositionSizer pair={pair} />
        </Section>

        {/* Confidence */}
        <Section label="AI Confidence">
          <div className="flex items-baseline justify-between">
            <div className="text-[26px] num font-semibold" style={{ color: confCol }}>{conf}%</div>
            <div className="text-[10px] text-mute tracking-[0.14em] uppercase">
              {conf >= 70 ? "High" : conf >= 40 ? "Moderate" : "Low"}
            </div>
          </div>
          <div className="mt-2 relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[40%] w-px bg-white/15"/>
            <div className="absolute inset-y-0 left-[70%] w-px bg-white/15"/>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${conf}%`, background: confCol, boxShadow: `0 0 10px ${confCol}` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-mute">
            <span>Signal threshold</span>
            <span className="num text-white">{threshold}%</span>
          </div>
          <input
            type="range" min="50" max="95"
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="slider w-full mt-1.5"
          />
        </Section>

        {/* Signal log */}
        <Section label="Signal Log" sub={`${history.length} signals`}>
          <div className="space-y-1.5">
            {history.length === 0 && (
              <div className="text-[11px] text-mute italic px-1">No signals yet — AI scanner monitoring…</div>
            )}
            {history.slice(0, 8).map((s, i) => (
              <div key={i} className="px-2.5 py-2 rounded-md bg-white/[0.02] border border-white/[0.05] flex items-center gap-3">
                <span className={`dot ${s.side === "BUY" ? "bg-accent-green" : "bg-accent-red"}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[11.5px] font-semibold text-white tracking-tight">{s.sym}</div>
                    <div className={`text-[9.5px] font-bold tracking-[0.16em] ${s.side === "BUY" ? "text-accent-green" : "text-accent-red"}`}>
                      {s.side}
                    </div>
                    <div className="text-[9.5px] text-mute">{s.tf}</div>
                  </div>
                  <div className="text-[10px] text-mute num truncate">
                    {fmt(s.entry, s.digits)} · {s.confidence}% · {timeAgo(s.time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  )
}

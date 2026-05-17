"use client"
import { useMemo, useState } from "react"
import type { Pair } from "@/app/lib/types"
import { buildSMCContext, type SMCContext, type OrderBlock, type FairValueGap } from "@/app/lib/smc"
import { fmt } from "@/app/lib/market-data"

interface Props {
  pairs: Pair[]
  selectedId: number
  onSelectPair: (id: number) => void
}

// ── Bias badge ────────────────────────────────────────────────
function BiasBadge({ bias }: { bias: string }) {
  const c = bias === "BULLISH" ? "#00ff88" : bias === "BEARISH" ? "#ff3d5a" : "#ffffff40"
  const arrow = bias === "BULLISH" ? "↑" : bias === "BEARISH" ? "↓" : "→"
  return (
    <span className="px-2.5 h-6 rounded-md text-[11px] font-bold tracking-[0.12em] inline-flex items-center gap-1"
      style={{ background: c + "18", color: c }}>
      {arrow} {bias}
    </span>
  )
}

// ── TF Card ───────────────────────────────────────────────────
function TFCard({
  label, color, smc, px, digits, hasBars,
}: {
  label: string; color: string; smc: SMCContext | null
  px: number; digits: number; hasBars: boolean
}) {
  if (!hasBars || !smc) {
    return (
      <div className="flex-1 panel rounded-xl p-4 flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: color }} />
          <div className="text-[13px] font-bold tracking-[0.1em] text-white">{label}</div>
        </div>
        <div className="text-[11px] text-mute italic">No data loaded</div>
      </div>
    )
  }

  const { structure, orderBlocks, h4OrderBlocks, fvgs, sweeps, divergence, daily, liquidity } = smc
  const obs = label === "H4" ? h4OrderBlocks : orderBlocks

  return (
    <div className="flex-1 panel rounded-xl p-4 flex flex-col gap-3 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 rounded-full" style={{ background: color }} />
          <div className="text-[13px] font-bold tracking-[0.1em] text-white">{label}</div>
        </div>
        <BiasBadge bias={structure.bias} />
      </div>

      {/* Zone */}
      <div className="flex items-center gap-2">
        {(() => {
          const zc = structure.zone === "DISCOUNT" ? "#00ff88" : structure.zone === "PREMIUM" ? "#ff3d5a" : "#ffffff50"
          return (
            <span className="text-[10px] font-semibold px-2 h-5 rounded flex items-center"
              style={{ background: zc + "18", color: zc }}>
              {structure.zone}
            </span>
          )
        })()}
        {structure.inOTE && (
          <span className="text-[10px] font-bold px-2 h-5 rounded bg-accent-violet/15 text-accent-violet flex items-center">
            OTE ★
          </span>
        )}
        {structure.lastBOS && (
          <span className="text-[10px] font-semibold num text-mute">
            {structure.lastBOS.kind} {structure.lastBOS.direction === "UP" ? "↑" : "↓"}
          </span>
        )}
      </div>

      {/* Daily context (D1 card) */}
      {label === "D1" && daily && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Daily Context</div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { l: "PDH", v: fmt(daily.pdHigh, digits), c: "#ffb80099" },
              { l: "PDL", v: fmt(daily.pdLow,  digits), c: "#ffb80099" },
              { l: "WK H", v: fmt(daily.weekHigh, digits), c: "#00d4ff66" },
              { l: "WK L", v: fmt(daily.weekLow,  digits), c: "#00d4ff66" },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.025]">
                <span className="text-[9.5px] text-mute">{l}</span>
                <span className="num text-[10px] font-semibold" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
          {daily.d1Bias !== "NEUTRAL" && (
            <div className="text-[10px] px-2 py-1 rounded bg-white/[0.025]">
              <span className="text-mute">D1 Trend: </span>
              <span className={`font-bold ${daily.d1Bias === "UP" ? "text-accent-green" : "text-accent-red"}`}>
                {daily.d1Bias === "UP" ? "↑ Bullish" : "↓ Bearish"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Order Blocks */}
      {obs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Order Blocks</div>
          {obs.slice(0, 3).map((ob, i) => {
            const isBull = ob.type === "bull"
            const c = isBull ? "#00ff88" : "#ff3d5a"
            const isNear = Math.abs(px - ob.mid) / px < 0.005
            return (
              <div key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                style={{
                  background: c + "0d",
                  border: isNear ? `1.5px solid ${c}80` : `1px solid ${c}30`,
                }}>
                <span className="text-[9.5px] font-bold w-6 shrink-0" style={{ color: c }}>
                  {isBull ? "↑" : "↓"}
                </span>
                <span className="num text-[10px] text-white flex-1 truncate">
                  {fmt(ob.low, digits)} – {fmt(ob.high, digits)}
                </span>
                <span className="text-[9px] shrink-0" style={{ color: c }}>
                  {"●".repeat(ob.strength)}
                </span>
                {isNear && (
                  <span className="text-[8px] font-bold tracking-[0.1em] shrink-0" style={{ color: c }}>NEAR</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* FVGs */}
      {fvgs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Fair Value Gaps</div>
          {fvgs.slice(0, 2).map((fvg, i) => {
            const c = fvg.type === "bull" ? "#00d4ff" : "#a78bfa"
            return (
              <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.025]">
                <span className="text-[9.5px] font-bold w-6 shrink-0" style={{ color: c }}>
                  {fvg.type === "bull" ? "↑G" : "↓G"}
                </span>
                <span className="num text-[10px] text-white">{fmt(fvg.bottom, digits)} – {fmt(fvg.top, digits)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Sweeps (H1 only) */}
      {label === "H1" && sweeps.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[0.16em] text-accent-yellow font-bold uppercase">⚡ Liquidity Sweeps</div>
          {sweeps.slice(0, 2).map((sw, i) => {
            const c = sw.type === "bull" ? "#00ff88" : "#ff3d5a"
            return (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                style={{ background: c + "0d", border: `1px solid ${c}35` }}>
                <span className="text-[9.5px] font-bold" style={{ color: c }}>
                  {sw.type === "bull" ? "↑ SS" : "↓ BS"}
                </span>
                <span className="num text-[10px] text-white flex-1">{fmt(sw.level, digits)}</span>
                <span className="text-[9px] text-mute">{sw.barsAgo}B ago</span>
              </div>
            )
          })}
        </div>
      )}

      {/* RSI Divergence (H1 only) */}
      {label === "H1" && divergence && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent-violet/10 border border-accent-violet/20">
          <span className="text-[9.5px] font-bold text-accent-violet tracking-[0.1em]">RSI DIV</span>
          <span className={`text-[10px] font-semibold ${divergence.type === "bullish" ? "text-accent-green" : "text-accent-red"}`}>
            {divergence.type === "bullish" ? "↑ Bullish" : "↓ Bearish"} ({divergence.strength})
          </span>
        </div>
      )}

      {/* Key liquidity levels */}
      {liquidity.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Liquidity</div>
          {liquidity.slice(0, 2).map((liq, i) => {
            const c = liq.type === "buyside" ? "#00ff8899" : "#ff3d5a99"
            return (
              <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.025]">
                <span className="text-[9.5px] font-bold" style={{ color: c }}>
                  {liq.type === "buyside" ? "BSL" : "SSL"}
                </span>
                <span className="num text-[10px] text-white">{fmt(liq.price, digits)}</span>
                <span className="text-[9px] text-mute">{liq.touches}×</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Price Ladder ──────────────────────────────────────────────
function PriceLadder({ h1Smc, h4Smc, px, digits }: {
  h1Smc: SMCContext | null; h4Smc: SMCContext | null; px: number; digits: number
}) {
  if (!h1Smc) return null

  const levels: Array<{ price: number; label: string; color: string; weight: number }> = []

  const addOB = (ob: OrderBlock, tf: string) => {
    const c = ob.type === "bull" ? "#00ff88" : "#ff3d5a"
    levels.push({ price: ob.high, label: `${tf} OB hi`, color: c, weight: ob.strength })
    levels.push({ price: ob.low,  label: `${tf} OB lo`, color: c, weight: ob.strength })
  }
  const addFVG = (fvg: FairValueGap) => {
    const c = fvg.type === "bull" ? "#00d4ff88" : "#a78bfa88"
    levels.push({ price: fvg.top,    label: "FVG top", color: c, weight: 1 })
    levels.push({ price: fvg.bottom, label: "FVG bot", color: c, weight: 1 })
  }

  h1Smc.orderBlocks.slice(0, 2).forEach(ob => addOB(ob, "H1"))
  h4Smc?.h4OrderBlocks.slice(0, 2).forEach(ob => addOB(ob, "H4"))
  h1Smc.fvgs.slice(0, 2).forEach(fvg => addFVG(fvg))
  if (h1Smc.daily) {
    levels.push({ price: h1Smc.daily.pdHigh, label: "PDH", color: "#ffb800", weight: 2 })
    levels.push({ price: h1Smc.daily.pdLow,  label: "PDL", color: "#ffb800", weight: 2 })
    levels.push({ price: h1Smc.daily.weekHigh, label: "WK H", color: "#00d4ff66", weight: 1 })
    levels.push({ price: h1Smc.daily.weekLow,  label: "WK L", color: "#00d4ff66", weight: 1 })
  }

  const allPrices = levels.map(l => l.price).concat([px])
  const lo = Math.min(...allPrices)
  const hi = Math.max(...allPrices)
  const range = hi - lo || 1
  const H = 300
  const toY = (p: number) => Math.round(H - ((p - lo) / range) * H)
  const deduped = Array.from(new Map(levels.map(l => [l.price, l])).values())
  const sorted = [...deduped]
    .sort((a, b) => b.price - a.price)

  return (
    <div className="panel rounded-xl p-4 flex flex-col gap-2">
      <div className="text-[9px] tracking-[0.2em] uppercase text-mute">Price Ladder · All TFs</div>
      <div className="relative" style={{ height: H + 20 }}>
        <svg viewBox={`0 0 260 ${H}`} className="w-full" style={{ height: H }}>
          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1="0" x2="260" y1={H * (1 - t)} y2={H * (1 - t)}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          {/* Level lines */}
          {sorted.map((l, i) => (
            <g key={i}>
              <line x1="30" x2="220" y1={toY(l.price)} y2={toY(l.price)}
                stroke={l.color} strokeWidth={l.weight} strokeDasharray={l.weight > 1 ? "none" : "3 3"} />
              <text x="225" y={toY(l.price) + 3.5} fontSize="7" fill={l.color} fontFamily="monospace">
                {fmt(l.price, digits)}
              </text>
              <text x="0" y={toY(l.price) + 3.5} fontSize="7" fill={l.color + "cc"} fontFamily="monospace">
                {l.label.slice(0, 5)}
              </text>
            </g>
          ))}
          {/* Current price */}
          <line x1="0" x2="260" y1={toY(px)} y2={toY(px)} stroke="#00d4ff" strokeWidth="1.5" />
          <rect x="80" y={toY(px) - 8} width="100" height="16" rx="3" fill="#00d4ff" opacity="0.85" />
          <text x="130" y={toY(px) + 4.5} fontSize="9" fill="#0a0e1a" fontFamily="monospace"
            textAnchor="middle" fontWeight="bold">
            {fmt(px, digits)}
          </text>
        </svg>
      </div>
    </div>
  )
}

// ── Alignment Score ───────────────────────────────────────────
function AlignmentCard({ d1Smc, h4Smc, h1Smc }: {
  d1Smc: SMCContext | null; h4Smc: SMCContext | null; h1Smc: SMCContext | null
}) {
  if (!h1Smc) return null

  const biases = [
    { tf: "D1", bias: d1Smc?.daily?.d1Bias === "UP" ? "BULLISH" : d1Smc?.daily?.d1Bias === "DOWN" ? "BEARISH" : h1Smc.daily?.d1Bias === "UP" ? "BULLISH" : "RANGING" },
    { tf: "H4", bias: h4Smc?.structure.bias ?? "RANGING" },
    { tf: "H1", bias: h1Smc.structure.bias },
  ]
  const bulls = biases.filter(b => b.bias === "BULLISH").length
  const bears = biases.filter(b => b.bias === "BEARISH").length
  const aligned = bulls === 3 || bears === 3
  const majority = bulls >= 2 ? "BULLISH" : bears >= 2 ? "BEARISH" : "MIXED"
  const tier = bulls === 3 || bears === 3 ? "A+" : bulls === 2 || bears === 2 ? "A" : "B/WAIT"
  const tierColor = tier === "A+" ? "#00ff88" : tier === "A" ? "#00d4ff" : "#ffb800"
  const biasColor = majority === "BULLISH" ? "#00ff88" : majority === "BEARISH" ? "#ff3d5a" : "#ffb800"

  return (
    <div className="panel rounded-xl p-4">
      <div className="text-[9px] tracking-[0.2em] uppercase text-mute mb-3">3-TF Alignment</div>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-[32px] font-black num" style={{ color: tierColor }}>{tier}</div>
          <div className="text-[10px] text-mute">Signal Tier</div>
        </div>
        <div className="flex-1 space-y-2">
          {biases.map(({ tf, bias }) => {
            const c = bias === "BULLISH" ? "#00ff88" : bias === "BEARISH" ? "#ff3d5a" : "#ffffff40"
            return (
              <div key={tf} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-7 text-mute">{tf}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: bias === "RANGING" ? "50%" : "100%",
                    background: c,
                  }} />
                </div>
                <span className="text-[10px] font-semibold w-16 text-right" style={{ color: c }}>{bias}</span>
              </div>
            )
          })}
        </div>
      </div>
      {aligned && (
        <div className="mt-3 px-3 py-2 rounded-md text-[11px] font-semibold"
          style={{ background: biasColor + "15", color: biasColor, border: `1px solid ${biasColor}30` }}>
          ✓ All 3 TFs aligned {majority === "BULLISH" ? "↑ LONG bias" : "↓ SHORT bias"} — highest probability setup
        </div>
      )}
      {!aligned && majority !== "MIXED" && (
        <div className="mt-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
          ⚠ Partial alignment — wait for {majority === "BULLISH" ? "H4/D1" : "D1"} confirmation
        </div>
      )}
      {majority === "MIXED" && (
        <div className="mt-3 px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.08] text-mute text-[11px]">
          No directional bias — stay out until structure clarifies
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────
export default function MTFView({ pairs, selectedId, onSelectPair }: Props) {
  const pair = pairs.find(p => p.id === selectedId) ?? pairs[0]
  const [localId, setLocalId] = useState(selectedId)
  const activePair = pairs.find(p => p.id === localId) ?? pair

  const h1Smc = useMemo(() =>
    activePair?.history.length >= 20
      ? buildSMCContext(activePair.history, activePair.px)
      : null,
    [activePair?.history, activePair?.px]
  )

  const h4Smc = useMemo(() =>
    activePair?.h4History && activePair.h4History.length >= 20
      ? buildSMCContext(activePair.h4History, activePair.px)
      : null,
    [activePair?.h4History, activePair?.px]
  )

  if (!activePair) return null
  const digits = activePair.digits

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-accent-violet/10 text-accent-violet flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="5" rx="1"/><rect x="2" y="9" width="13" height="5" rx="1"/>
              <rect x="2" y="16" width="8" height="5" rx="1"/>
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-semibold text-white tracking-tight">Multi-Timeframe Analysis</div>
            <div className="text-[11px] text-mute mt-0.5">D1 → H4 → H1 top-down confluence</div>
          </div>
        </div>

        {/* Pair selector */}
        <select
          value={localId}
          onChange={e => setLocalId(+e.target.value)}
          className="h-9 px-3 rounded-md glass bg-transparent text-[12px] text-white outline-none border border-white/[0.06] cursor-pointer"
        >
          {pairs.filter(p => p.active).map(p => (
            <option key={p.id} value={p.id} className="bg-[#0a0e1a]">{p.sym}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        <div className="space-y-4">
          {/* 3 TF cards side by side */}
          <div className="flex gap-4 min-w-0">
            <TFCard label="D1"  color="#ffb800" smc={h1Smc} px={activePair.px} digits={digits} hasBars={activePair.history.length >= 20} />
            <TFCard label="H4"  color="#00d4ff" smc={h4Smc} px={activePair.px} digits={digits} hasBars={(activePair.h4History?.length ?? 0) >= 20} />
            <TFCard label="H1"  color="#00ff88" smc={h1Smc} px={activePair.px} digits={digits} hasBars={activePair.history.length >= 20} />
          </div>

          {/* Bottom row: alignment + price ladder */}
          <div className="flex gap-4">
            <div className="flex-1">
              <AlignmentCard d1Smc={h1Smc} h4Smc={h4Smc} h1Smc={h1Smc} />
            </div>
            <div className="w-[280px]">
              <PriceLadder h1Smc={h1Smc} h4Smc={h4Smc} px={activePair.px} digits={digits} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

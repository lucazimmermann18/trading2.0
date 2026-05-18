"use client"
import { useState, useRef } from "react"
import type { Pair } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { PROVIDERS, BADGE_COLORS, type ProviderKey } from "@/app/lib/ai-providers"
import type { useAISettings } from "@/app/hooks/useAISettings"
import type { useNotificationSettings } from "@/app/hooks/useNotificationSettings"

type AISettingsHook = ReturnType<typeof useAISettings>
type NotifSettingsHook = ReturnType<typeof useNotificationSettings>

interface Props {
  open: boolean
  onClose: () => void
  pairs: Pair[]
  onTogglePair: (id: number) => void
  onAddPair: (sym: string, group: string) => void
  onRemovePair: (id: number) => void
  threshold: number
  setThreshold: (n: number) => void
  aiSettings: AISettingsHook
  notifSettings: NotifSettingsHook
}

const TABS = [
  { k: "ai-models", label: "AI Models",        icon: "M" },
  { k: "pairs",     label: "Pairs & Markets",  icon: "P" },
  { k: "strategy",  label: "Scanner",           icon: "S" },
  { k: "notif",     label: "Notifications",    icon: "N" },
  { k: "apis",      label: "API Connections",  icon: "C" },
  { k: "schedule",  label: "Schedule",         icon: "T" },
] as const

type TabKey = typeof TABS[number]["k"]

function Field({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1">
      <div className="text-[11px] tracking-[0.14em] uppercase text-mute">{label}</div>
      {hint && <div className="text-[11px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-md bg-white/[0.025] border border-white/[0.06] text-[12px] text-white outline-none focus:border-accent-blue/50 placeholder:text-mute/50 transition"
    />
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors shrink-0
        ${checked ? "bg-accent-blue/70" : "bg-white/10"}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all shadow-sm
        ${checked ? "left-[22px]" : "left-[3px]"}`} />
    </button>
  )
}

/* ── AI Models Tab ─────────────────────────────────────────── */
function AIModelsTab({ aiSettings }: { aiSettings: AISettingsHook }) {
  const { settings, save, setApiKey, setSelectedModel } = aiSettings

  // Per-provider local state for key entry (key never stored in component state after save)
  const [pendingKey, setPendingKey]   = useState<Record<ProviderKey, string>>({ anthropic: "", openai: "", deepseek: "", gemini: "" })
  const [replaceMode, setReplaceMode] = useState<Record<ProviderKey, boolean>>({ anthropic: false, openai: false, deepseek: false, gemini: false })
  const [saveState, setSaveState]     = useState<Record<ProviderKey, "idle" | "saving" | "ok" | "fail">>({ anthropic: "idle", openai: "idle", deepseek: "idle", gemini: "idle" })
  const [testState, setTestState]     = useState<Record<ProviderKey, "idle" | "loading" | "ok" | "fail">>({ anthropic: "idle", openai: "idle", deepseek: "idle", gemini: "idle" })

  const handleSaveKey = async (providerKey: ProviderKey) => {
    const key = pendingKey[providerKey].trim()
    if (!key) return
    const model = settings.selectedModels[providerKey]
    setSaveState(s => ({ ...s, [providerKey]: "saving" }))
    const ok = await setApiKey(providerKey, key, model)
    setSaveState(s => ({ ...s, [providerKey]: ok ? "ok" : "fail" }))
    if (ok) {
      setPendingKey(s => ({ ...s, [providerKey]: "" }))
      setReplaceMode(s => ({ ...s, [providerKey]: false }))
      setTimeout(() => setSaveState(s => ({ ...s, [providerKey]: "idle" })), 2500)
    } else {
      setTimeout(() => setSaveState(s => ({ ...s, [providerKey]: "idle" })), 4000)
    }
  }

  const testConnection = async (providerKey: ProviderKey) => {
    if (!settings.keyStatus[providerKey]) return
    setTestState(s => ({ ...s, [providerKey]: "loading" }))
    try {
      const model = settings.selectedModels[providerKey]
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerKey, model,
          phase: "strategic",
          sym: "EUR/USD", px: 1.0890, digits: 5, spread: 0.6,
          skillset: "Smart Money Concepts", timeframe: "H1",
          rsi: 52, macdLine: 0.0002, signalLine: 0.0001, histogram: 0.0001,
          bb: { upper: 1.0920, mid: 1.0890, lower: 1.0860 },
          trend: "UP", support: [1.0860], resistance: [1.0920],
          activeSessions: ["London"], atr: 0.0015,
          candlePatterns: [],
          htf: { trend: "UP", rsi: 55, support: [1.0840], resistance: [1.0950], lastClose: 1.0880, lastBarBullish: true },
          smc: {
            structure: { bias: "BULLISH", zone: "DISCOUNT", inOTE: false, lastBOS: null, recentSwingHigh: 1.0930, recentSwingLow: 1.0850 },
            orderBlocks: [], h4OrderBlocks: [], fvgs: [], liquidity: [], sweeps: [], divergence: null,
            daily: { pdHigh: 1.0920, pdLow: 1.0850, weekHigh: 1.0950, weekLow: 1.0820, d1Bias: "BULLISH", d1OBs: [] },
          },
          history: Array.from({ length: 20 }, (_, i) => ({
            time: Math.floor(Date.now() / 1000) - (19 - i) * 3600,
            open: 1.0880 + (i % 3) * 0.0002, high: 1.0895 + (i % 3) * 0.0002,
            low: 1.0870 + (i % 3) * 0.0002,  close: 1.0888 + (i % 3) * 0.0002,
          })),
        }),
      })
      setTestState(s => ({ ...s, [providerKey]: res.ok ? "ok" : "fail" }))
    } catch {
      setTestState(s => ({ ...s, [providerKey]: "fail" }))
    }
    setTimeout(() => setTestState(s => ({ ...s, [providerKey]: "idle" })), 4000)
  }

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-accent-blue/[0.06] border border-accent-blue/20">
        <div>
          <div className="text-[12px] font-semibold text-white">Use AI for signal generation</div>
          <div className="text-[10.5px] text-mute mt-0.5">
            When enabled, scan results are powered by the selected AI model instead of the built-in engine
          </div>
        </div>
        <Toggle checked={settings.useAI} onChange={v => save({ useAI: v })} />
      </div>

      {/* Active provider selector */}
      <div>
        <Field label="Active AI Provider" hint="The provider used for all scan analysis" />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {PROVIDERS.map(p => {
            const hasKey = settings.keyStatus[p.key]
            const isActive = settings.activeProvider === p.key
            return (
              <button
                key={p.key}
                onClick={() => save({ activeProvider: p.key })}
                className={`relative h-16 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition
                  ${isActive
                    ? "border-accent-blue/50 bg-accent-blue/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ background: p.color + "33", color: p.color }}
                >
                  {p.icon}
                </div>
                <div className="text-[10px] font-medium text-white">{p.name}</div>
                {hasKey && (
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-green" />
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent-blue" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Per-provider configuration */}
      <div className="space-y-3">
        {PROVIDERS.map(provider => {
          const hasKey  = settings.keyStatus[provider.key]
          const model   = settings.selectedModels[provider.key]
          const isActive = settings.activeProvider === provider.key
          const tState  = testState[provider.key]
          const sState  = saveState[provider.key]
          const inReplace = replaceMode[provider.key]

          return (
            <div
              key={provider.key}
              className={`rounded-lg border p-3.5 transition
                ${isActive ? "border-accent-blue/30 bg-accent-blue/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold"
                    style={{ background: provider.color + "22", color: provider.color }}
                  >
                    {provider.icon}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-white">{provider.name}</div>
                    <div className="text-[10px] text-mute">{provider.models.length} models available</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasKey ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-accent-green font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                      KEY SET
                    </div>
                  ) : (
                    <div className="text-[10px] text-mute">No key</div>
                  )}
                  {!isActive && (
                    <button
                      onClick={() => save({ activeProvider: provider.key })}
                      className="h-6 px-2.5 rounded-[5px] text-[10px] border border-white/10 text-mute hover:text-white hover:border-white/20 transition"
                    >
                      Use
                    </button>
                  )}
                  {isActive && (
                    <div className="h-6 px-2.5 rounded-[5px] text-[10px] border border-accent-blue/40 text-accent-blue bg-accent-blue/10 flex items-center">
                      Active
                    </div>
                  )}
                </div>
              </div>

              {/* API Key row */}
              <div className="mb-3">
                <div className="text-[10px] tracking-[0.14em] uppercase text-mute mb-1.5">API Key</div>

                {hasKey && !inReplace ? (
                  /* Key exists — show masked indicator + action buttons */
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-8 px-3 rounded-md bg-white/[0.02] border border-accent-green/20 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                      <span className="text-[11px] font-mono text-accent-green/80 tracking-widest select-none">
                        ●●●●●●●●●●●●
                      </span>
                      <span className="text-[9.5px] text-mute ml-auto">Gespeichert</span>
                    </div>
                    <button
                      onClick={() => testConnection(provider.key)}
                      disabled={tState === "loading"}
                      className={`h-8 px-2.5 rounded-md text-[11px] font-medium transition whitespace-nowrap
                        ${tState === "ok"      ? "bg-accent-green/20 text-accent-green border border-accent-green/30"
                        : tState === "fail"    ? "bg-accent-red/20 text-accent-red border border-accent-red/30"
                        : tState === "loading" ? "border border-white/10 text-mute cursor-wait"
                        : "border border-white/10 text-white hover:border-white/20"}`}
                    >
                      {tState === "loading" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          Test
                        </span>
                      ) : tState === "ok" ? "✓ OK" : tState === "fail" ? "✗ Fail" : "Test"}
                    </button>
                    <button
                      onClick={() => setReplaceMode(s => ({ ...s, [provider.key]: true }))}
                      className="h-8 px-2.5 rounded-md text-[11px] border border-white/10 text-mute hover:text-white hover:border-white/20 transition whitespace-nowrap"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  /* No key yet, or in replace mode — show input + Save button */
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={pendingKey[provider.key]}
                      onChange={e => setPendingKey(s => ({ ...s, [provider.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") void handleSaveKey(provider.key) }}
                      placeholder={`${provider.name} API key…`}
                      className="flex-1 h-8 px-3 rounded-md bg-white/[0.03] border border-white/[0.06] text-[11.5px] text-white outline-none focus:border-accent-blue/40 placeholder:text-mute/40 transition font-mono"
                    />
                    {inReplace && (
                      <button
                        onClick={() => { setReplaceMode(s => ({ ...s, [provider.key]: false })); setPendingKey(s => ({ ...s, [provider.key]: "" })) }}
                        className="h-8 px-2.5 rounded-md text-[11px] border border-white/10 text-mute hover:text-white transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => void handleSaveKey(provider.key)}
                      disabled={!pendingKey[provider.key].trim() || sState === "saving"}
                      className={`h-8 px-3 rounded-md text-[11px] font-medium transition whitespace-nowrap
                        ${!pendingKey[provider.key].trim() ? "opacity-30 cursor-not-allowed border border-white/[0.06] text-mute"
                          : sState === "ok"     ? "bg-accent-green/20 text-accent-green border border-accent-green/30"
                          : sState === "fail"   ? "bg-accent-red/20 text-accent-red border border-accent-red/30"
                          : sState === "saving" ? "border border-white/10 text-mute cursor-wait"
                          : "bg-accent-blue/20 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/30"}`}
                    >
                      {sState === "saving" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          Saving
                        </span>
                      ) : sState === "ok" ? "✓ Saved" : sState === "fail" ? "✗ Failed" : "Save Key"}
                    </button>
                  </div>
                )}
              </div>

              {/* Model selector */}
              <div>
                <div className="text-[10px] tracking-[0.14em] uppercase text-mute mb-1.5">Model</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {provider.models.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(provider.key, m.id)}
                      className={`flex items-center justify-between px-2.5 h-9 rounded-md border text-left transition
                        ${model === m.id
                          ? "border-accent-blue/40 bg-accent-blue/[0.07] "
                          : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                    >
                      <div className="text-[11px] text-white font-medium truncate pr-2">{m.label}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-mute num">{m.context}</span>
                        {m.badge && (
                          <span className={`text-[8px] font-bold tracking-[0.1em] px-1.5 py-0.5 rounded-[3px] ${BADGE_COLORS[m.badge]}`}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[10.5px] text-mute leading-relaxed">
        <span className="text-white/60 font-medium">Security: </span>
        API keys are stored encrypted in your private Supabase database and are never exposed to the browser. All AI calls are routed through this app&apos;s server-side API.
      </div>
    </div>
  )
}

/* ── Pairs Tab ─────────────────────────────────────────────── */
const CUSTOM_GROUPS = ["FX Major", "FX Cross", "Metals", "Crypto", "Index", "Energy", "Custom"]

function PairsTab({ pairs, onTogglePair, onAddPair, onRemovePair }: {
  pairs: Pair[]
  onTogglePair: (id: number) => void
  onAddPair: (sym: string, group: string) => void
  onRemovePair: (id: number) => void
}) {
  const [newSym, setNewSym] = useState("")
  const [newGroup, setNewGroup] = useState("FX Cross")
  const [addErr, setAddErr] = useState("")

  const builtIn = pairs.filter(p => p.id < 1000)
  const custom  = pairs.filter(p => p.id >= 1000)
  const groups  = Array.from(new Set(builtIn.map(p => p.group)))

  const handleAdd = () => {
    const sym = newSym.trim().toUpperCase()
    if (!sym) { setAddErr("Enter a symbol"); return }
    if (pairs.some(p => p.sym === sym)) { setAddErr("Already exists"); return }
    setAddErr("")
    onAddPair(sym, newGroup)
    setNewSym("")
  }

  return (
    <div className="space-y-1">
      <Field label="Active pairs for AI scanning" hint="Disabled pairs will not be analyzed during scan cycles." />
      {groups.map(g => (
        <div key={g} className="mt-4">
          <div className="text-[10px] tracking-[0.18em] uppercase text-mute mb-2 px-1">{g}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {builtIn.filter(p => p.group === g).map(p => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 px-3 h-11 rounded-md bg-white/[0.025] border border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition"
              >
                <input type="checkbox" checked={p.active} onChange={() => onTogglePair(p.id)} className="accent-[#00d4ff] w-3.5 h-3.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white font-medium">{p.sym}</div>
                  <div className="text-[9.5px] text-mute tracking-[0.1em]">{p.name}</div>
                </div>
                <div className="text-[10px] num text-mute">{fmt(p.px, p.digits)}</div>
              </label>
            ))}
          </div>
        </div>
      ))}

      {/* Custom pairs */}
      <div className="mt-6 pt-4 border-t border-white/[0.06]">
        <div className="text-[10px] tracking-[0.18em] uppercase text-mute mb-3 px-1 flex items-center gap-2">
          Custom Pairs
          <span className="px-1.5 h-4 rounded bg-accent-violet/20 text-accent-violet text-[9px] font-bold flex items-center">
            {custom.length}
          </span>
        </div>

        {custom.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {custom.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 h-11 rounded-md bg-accent-violet/[0.04] border border-accent-violet/20">
                <input type="checkbox" checked={p.active} onChange={() => onTogglePair(p.id)} className="accent-[#00d4ff] w-3.5 h-3.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white font-medium">{p.sym}</div>
                  <div className="text-[9.5px] text-mute">{p.group}</div>
                </div>
                <button
                  onClick={() => onRemovePair(p.id)}
                  className="text-mute hover:text-accent-red transition shrink-0"
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add custom pair form */}
        <div className="flex gap-2">
          <input
            value={newSym}
            onChange={e => { setNewSym(e.target.value); setAddErr("") }}
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
            placeholder="e.g. GBP/NZD or AAPL"
            className="flex-1 h-9 px-3 rounded-md bg-white/[0.025] border border-white/[0.06] text-[12px] text-white outline-none focus:border-accent-blue/50 placeholder:text-mute/50 uppercase transition"
          />
          <select
            value={newGroup}
            onChange={e => setNewGroup(e.target.value)}
            className="h-9 px-2 rounded-md bg-white/[0.025] border border-white/[0.06] text-[11px] text-white outline-none cursor-pointer"
          >
            {CUSTOM_GROUPS.map(g => <option key={g} value={g} className="bg-[#0a0e1a]">{g}</option>)}
          </select>
          <button
            onClick={handleAdd}
            className="h-9 px-4 rounded-md bg-accent-blue/15 text-accent-blue text-[11px] font-bold tracking-[0.14em] hover:bg-accent-blue/25 transition shrink-0"
            style={{ boxShadow: "inset 0 0 0 1px rgba(0,212,255,0.2)" }}
          >
            ADD
          </button>
        </div>
        {addErr && <div className="text-[10px] text-accent-red mt-1.5 px-1">{addErr}</div>}
        <div className="text-[10px] text-mute mt-2 px-1 leading-relaxed">
          Symbol must be valid on Twelve Data (e.g. EUR/CAD, AAPL, GER40). Bars will load automatically.
        </div>
      </div>
    </div>
  )
}

/* ── Strategy Tab ──────────────────────────────────────────── */
function StrategyTab({
  threshold, setThreshold,
}: {
  threshold: number; setThreshold: (n: number) => void
}) {
  return (
    <div className="space-y-6">
      <div className="px-4 py-3.5 rounded-xl border border-accent-blue/20 bg-accent-blue/[0.05] space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
          <span className="text-[11px] font-bold text-accent-blue tracking-[0.14em]">AI AUTO-ANALYSIS ACTIVE</span>
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed">
          The AI autonomously selects the best trading approach for each market — Smart Money Concepts, trend, breakout, or reversal — and only signals when a genuine A or A+ setup is present.
        </p>
        <p className="text-[10px] text-white/40 leading-relaxed">
          No manual strategy selection required. The AI adapts to current market conditions automatically.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Field label="Confidence threshold" hint="Only fire alerts when AI confidence exceeds this value." />
          <div className="num text-[18px] font-semibold text-white">{threshold}%</div>
        </div>
        <input
          type="range" min={50} max={95} value={threshold}
          onChange={e => setThreshold(+e.target.value)}
          className="slider w-full mt-2"
        />
        <div className="flex justify-between text-[9.5px] text-mute mt-1.5 num">
          <span>50%</span><span className="text-mute/50">threshold</span><span>95%</span>
        </div>
      </div>

      <div>
        <Field label="Risk profile" hint="Affects R:R targets and SL placement multipliers." />
        <div className="flex gap-2 mt-2">
          {["Conservative", "Balanced", "Aggressive"].map((l, i) => (
            <button
              key={l}
              className={`flex-1 h-10 rounded-md border text-[12px] transition
                ${i === 1
                  ? "border-accent-blue/50 bg-accent-blue/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-mute hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Field label="Scan interval" />
        <div className="flex gap-2 mt-2">
          {["1 min", "5 min", "15 min", "30 min"].map((l, i) => (
            <button
              key={l}
              className={`flex-1 h-9 rounded-md border text-[11.5px] num transition
                ${i === 1
                  ? "border-accent-blue/50 bg-accent-blue/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-mute hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Notifications Tab ─────────────────────────────────────── */
function NotificationsTab({ notifSettings }: { notifSettings: NotifSettingsHook }) {
  const { settings, setField } = notifSettings
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const setChannel = (c: keyof typeof settings.channels, v: boolean) =>
    setField("channels", { ...settings.channels, [c]: v })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: {
            sym: "XAU/USD", side: "BUY", entry: 2342.18, sl: 2320.00,
            tp1: 2365.00, tp2: 2390.00, confidence: 82, rr: "2.40",
            tf: "H1", skillset: "Smart Money Concepts",
            why: "Test alert from TradeAI Pro settings.", digits: 2,
          },
          channels: settings.channels,
          telegramToken: settings.telegramToken,
          telegramChatId: settings.telegramChatId,
          webhookUrl: settings.webhookUrl,
          discordWebhookUrl: settings.discordWebhookUrl,
        }),
      })
      const data = await res.json()
      setTestResult(res.ok ? "Test sent successfully" : (data.error ?? "Send failed"))
    } catch {
      setTestResult("Network error")
    }
    setTesting(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(settings.channels) as (keyof typeof settings.channels)[]).map(c => (
          <label
            key={c}
            className={`flex items-center gap-2.5 px-3 h-10 rounded-md border cursor-pointer transition
              ${settings.channels[c] ? "border-accent-blue/30 bg-accent-blue/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
          >
            <Toggle checked={settings.channels[c]} onChange={v => setChannel(c, v)} />
            <span className="text-[12px] text-white capitalize">{c}</span>
          </label>
        ))}
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <Field label="Telegram bot token" />
          <TextInput value={settings.telegramToken} onChange={v => setField("telegramToken", v)} placeholder="123456:ABC-DEF…" type="password" />
        </div>
        <div>
          <Field label="Telegram chat ID" />
          <TextInput value={settings.telegramChatId} onChange={v => setField("telegramChatId", v)} placeholder="-1001234567890" />
        </div>
        <div>
          <Field label="Webhook URL" />
          <TextInput value={settings.webhookUrl} onChange={v => setField("webhookUrl", v)} placeholder="https://yourdomain.com/hooks/tradeai" />
        </div>
        <div>
          <Field label="Discord webhook URL" />
          <TextInput value={settings.discordWebhookUrl} onChange={v => setField("discordWebhookUrl", v)} placeholder="https://discord.com/api/webhooks/…" type="password" />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleTest}
          disabled={testing}
          className="h-8 px-4 rounded-md border border-white/10 text-[11px] text-white hover:bg-white/[0.04] transition disabled:opacity-40"
        >
          {testing ? "Sending…" : "Send test alert"}
        </button>
        {testResult && (
          <span className={`text-[11px] ${testResult.includes("success") ? "text-accent-green" : "text-accent-red"}`}>
            {testResult}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── API Connections Tab ───────────────────────────────────── */
function APIsTab() {
  const connections = [
    { n: "Twelve Data",  d: "Multi-asset prices · OHLCV + streaming",   st: "connected",    model: "REST" },
    { n: "OANDA",        d: "REST + Streaming · forex, indices, metals", st: "disconnected", model: "REST" },
    { n: "MetaApi",      d: "MT4/MT5 bridge for execution",              st: "disconnected", model: "WebSocket" },
    { n: "Alpaca",       d: "US equities + crypto",                       st: "disconnected", model: "REST" },
    { n: "CoinGecko",    d: "Crypto prices + market cap data",            st: "disconnected", model: "REST" },
  ]
  return (
    <div className="space-y-2">
      <Field label="Data feed connections" hint="Configure market data sources for real-time price feeds." />
      <div className="space-y-2 mt-3">
        {connections.map(c => (
          <div
            key={c.n}
            className="flex items-center gap-3 px-3 h-14 rounded-md bg-white/[0.02] border border-white/[0.06]"
          >
            <div className="w-8 h-8 rounded-md bg-white/[0.04] flex items-center justify-center text-mute shrink-0">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-white font-medium">{c.n}</div>
              <div className="text-[10.5px] text-mute">{c.d}</div>
            </div>
            <div className="text-[9px] font-medium tracking-[0.12em] border rounded-[4px] px-1.5 py-0.5 text-mute border-white/10">{c.model}</div>
            <div className={`text-[10px] font-bold tracking-[0.14em] w-24 text-right
              ${c.st === "connected" ? "text-accent-green" : "text-mute"}`}>
              {c.st === "connected" ? "● CONNECTED" : "○ OFFLINE"}
            </div>
            <button className="h-7 px-3 rounded-md border border-white/10 text-[11px] text-white hover:bg-white/[0.04] transition shrink-0">
              Configure
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Schedule Tab ──────────────────────────────────────────── */
const SCHEDULE_KEY = "tradeai_schedule_v1"
const MAX_SIGNALS_OPTIONS = ["3", "5", "10", "Unlimited"]
const SESSION_DEFS = [
  { key: "tokyo",  label: "Tokyo",    open: 23, close: 8  },
  { key: "london", label: "London",   open: 8,  close: 17 },
  { key: "ny",     label: "New York", open: 13, close: 22 },
  { key: "sydney", label: "Sydney",   open: 21, close: 6  },
]

function loadSchedule() {
  if (typeof window === "undefined") return { active: ["london", "ny"], blackout: "", maxSignals: "5" }
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (raw) return JSON.parse(raw) as { active: string[]; blackout: string; maxSignals: string }
  } catch {}
  return { active: ["london", "ny"], blackout: "", maxSignals: "5" }
}

function ScheduleTab() {
  const [sched, setSched] = useState(loadSchedule)

  const persist = (patch: Partial<typeof sched>) => {
    setSched(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const toggleSession = (k: string) =>
    persist({ active: sched.active.includes(k) ? sched.active.filter(x => x !== k) : [...sched.active, k] })

  return (
    <div className="space-y-5">
      <div>
        <Field label="Trading windows (UTC)" hint="Limit scans to market hours when liquidity is highest." />
        <div className="grid grid-cols-2 gap-2 mt-3">
          {SESSION_DEFS.map(s => (
            <div
              key={s.key}
              className={`px-3 py-2.5 rounded-md border flex items-center justify-between transition
                ${sched.active.includes(s.key) ? "border-accent-blue/30 bg-accent-blue/[0.05]" : "border-white/[0.06] bg-white/[0.02]"}`}
            >
              <div>
                <div className="text-[12px] text-white">{s.label}</div>
                <div className="text-[10px] text-mute num">
                  {String(s.open).padStart(2, "0")}:00 → {String(s.close).padStart(2, "0")}:00 UTC
                </div>
              </div>
              <Toggle checked={sched.active.includes(s.key)} onChange={() => toggleSession(s.key)} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Field label="Blackout periods" hint="Pause AI during high-impact news or rollover (e.g. Fri 21:00 - Sun 22:00)" />
        <TextInput
          value={sched.blackout}
          onChange={v => persist({ blackout: v })}
          placeholder="Fri 21:00 - Sun 22:00 UTC"
        />
      </div>
      <div>
        <Field label="Max signals per session" />
        <div className="flex gap-2 mt-2">
          {MAX_SIGNALS_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => persist({ maxSignals: n })}
              className={`flex-1 h-9 rounded-md border text-[12px] num transition
                ${sched.maxSignals === n
                  ? "border-accent-blue/50 bg-accent-blue/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-mute hover:text-white"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main Modal ────────────────────────────────────────────── */
export default function SettingsModal({
  open, onClose,
  pairs, onTogglePair, onAddPair, onRemovePair,
  threshold, setThreshold,
  aiSettings, notifSettings,
}: Props) {
  const [tab, setTab] = useState<TabKey>("ai-models")
  const overlayRef = useRef<HTMLDivElement>(null)

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-riseIn"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-h-[100dvh] md:w-[900px] md:max-h-[86vh] panel rounded-none md:rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b hairline shrink-0">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#00d4ff" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <div className="text-[13px] font-semibold tracking-tight text-white">Settings</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-mute hover:text-white hover:bg-white/[0.06] transition"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
          {/* Sidebar */}
          <div className="flex flex-row overflow-x-auto scrollbar-none gap-1 p-2 border-b hairline shrink-0 md:flex-col md:w-[200px] md:border-b-0 md:border-r md:space-y-0.5">
            {TABS.map(t => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`shrink-0 whitespace-nowrap md:w-full text-left px-3 h-9 rounded-md text-[12px] transition flex items-center gap-2.5
                  ${tab === t.k
                    ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                    : "text-mute hover:text-white hover:bg-white/[0.03] border border-transparent"}`}
              >
                {t.k === "ai-models" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2z"/>
                    <path d="M12 18a2 2 0 0 1 2 2v0a2 2 0 0 1-4 0v0a2 2 0 0 1 2-2z"/>
                    <path d="M4.93 4.93a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83L4.93 7.76a2 2 0 0 1 0-2.83z"/>
                    <path d="M14.83 14.83a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83l-1.41-1.41a2 2 0 0 1 0-2.83z"/>
                    <path d="M2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 0 4H4a2 2 0 0 1-2-2z"/>
                    <path d="M18 12a2 2 0 0 1 2-2h0a2 2 0 0 1 0 4h0a2 2 0 0 1-2-2z"/>
                  </svg>
                )}
                {t.k === "pairs" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                )}
                {t.k === "strategy" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M3 17l6-6 4 4 8-8"/>
                  </svg>
                )}
                {t.k === "notif" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                )}
                {t.k === "apis" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4"/>
                  </svg>
                )}
                {t.k === "schedule" && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                )}
                {t.label}
                {t.k === "ai-models" && (
                  <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-[3px] bg-accent-blue/20 text-accent-blue tracking-[0.1em]">
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 min-h-0">
            {tab === "ai-models"  && <AIModelsTab aiSettings={aiSettings} />}
            {tab === "pairs"      && <PairsTab pairs={pairs} onTogglePair={onTogglePair} onAddPair={onAddPair} onRemovePair={onRemovePair} />}
            {tab === "strategy"   && <StrategyTab threshold={threshold} setThreshold={setThreshold} />}
            {tab === "notif"      && <NotificationsTab notifSettings={notifSettings} />}
            {tab === "apis"       && <APIsTab />}
            {tab === "schedule"   && <ScheduleTab />}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-3 md:px-4 flex items-center justify-between border-t hairline shrink-0">
          <div className="hidden md:block text-[10.5px] text-mute">
            Changes to AI keys and models are saved automatically
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-md border border-white/10 text-[12px] text-mute hover:text-white hover:border-white/20 transition"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-md bg-accent-blue text-ink-950 text-[12px] font-semibold hover:bg-accent-blue/90 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

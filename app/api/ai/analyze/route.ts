import { NextRequest, NextResponse } from "next/server"
import { dbGetAPIKey } from "@/app/lib/actions/apikeys"

interface OHLCV { time: number; open: number; high: number; low: number; close: number }

interface CandlePattern { name: string; type: "bullish" | "bearish" | "neutral"; strength: number }
interface HTFContext {
  trend: "UP" | "DOWN" | "NEUTRAL"; rsi: number
  support: number[]; resistance: number[]
  lastClose: number; lastBarBullish: boolean
}

interface SMCOrderBlock { type: "bull" | "bear"; high: number; low: number; mid: number; strength: number }
interface SMCFVG { type: "bull" | "bear"; top: number; bottom: number; mid: number }
interface SMCLiquidity { type: "buyside" | "sellside"; price: number; touches: number }
interface SMCSweep { type: "bull" | "bear"; level: number; barsAgo: number; strength: number }
interface SMCDivergence { type: "bullish" | "bearish"; strength: string }
interface SMCDaily { pdHigh: number; pdLow: number; weekHigh: number; weekLow: number; d1Bias: string; d1OBs: SMCOrderBlock[] }
interface SMCStructure {
  bias: "BULLISH" | "BEARISH" | "RANGING"
  zone: "PREMIUM" | "DISCOUNT" | "EQUILIBRIUM"
  inOTE: boolean
  lastBOS: { kind: string; direction: string; price: number } | null
  recentSwingHigh: number
  recentSwingLow: number
}
interface SMCData {
  structure: SMCStructure
  orderBlocks: SMCOrderBlock[]
  h4OrderBlocks: SMCOrderBlock[]
  fvgs: SMCFVG[]
  liquidity: SMCLiquidity[]
  sweeps: SMCSweep[]
  divergence: SMCDivergence | null
  daily: SMCDaily
}

interface D1ContextData {
  trend: "UP" | "DOWN" | "NEUTRAL"
  rsi: number
  regime: string
  support: number[]
  resistance: number[]
  lastClose: number
  lastBarBullish: boolean
  weekHigh: number
  weekLow: number
  monthHigh: number
  monthLow: number
}

interface TradeLessonSummary {
  sym: string
  side: "BUY" | "SELL"
  outcome: string
  pnl_r: number
  lesson: string
  mistakes: string[]
  nextTime: string
}

interface WatchZoneInput {
  direction: "BUY" | "SELL"
  zoneTop: number
  zoneBottom: number
  activateAt: number
  reason: string
  invalidateIf: string
}

interface UpcomingNews {
  time: string
  event: string
  impact: string
  minsUntil: number
}

interface AnalyzeRequest {
  provider: "anthropic" | "openai" | "deepseek" | "gemini"
  model: string
  apiKey: string  // always injected server-side; client value is discarded
  sym: string
  px: number
  digits: number
  spread: number
  history: OHLCV[]
  skillset: string
  // H1 indicators
  rsi: number
  macdLine: number
  signalLine: number
  histogram: number
  bb: { upper: number; mid: number; lower: number }
  trend: "UP" | "DOWN" | "NEUTRAL"
  support: number[]
  resistance: number[]
  activeSessions: string[]
  timeframe: string
  // ATR, candle patterns, H4 context
  atr: number
  candlePatterns: CandlePattern[]
  htf: HTFContext
  // SMC context
  smc: SMCData
  // Two-phase fields
  phase: "strategic" | "tactical"
  watchContext?: WatchZoneInput[]   // populated in tactical phase
  upcomingNews?: UpcomingNews[]
  session?: string
  // AI autonomy enhancements
  regime?: string
  regimeStrength?: number
  d1Context?: D1ContextData
  lessons?: TradeLessonSummary[]
}

interface WatchZoneResult {
  direction: "BUY" | "SELL"
  zoneTop: number
  zoneBottom: number
  activateAt: number
  reason: string
  invalidateIf: string
}

interface AIResult {
  status: "TRADE" | "WATCH" | "NO_TRADE"
  // TRADE fields
  side?: "BUY" | "SELL"
  confidence?: number
  entry?: number
  sl?: number
  tp1?: number
  tp2?: number
  rr?: string
  confluences?: string[]
  reasoning?: string
  // WATCH fields
  watchZones?: WatchZoneResult[]
  // Cache metadata (added server-side, not from Claude)
  _cache?: { hit: boolean; savedTokens: number }
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite institutional trading analyst. You operate in two phases and output only valid JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## OPERATING MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STRATEGIC PHASE
Full market analysis. No levels have been pre-filtered. You see everything.
Decision tree:
  1. Is there an IMMEDIATE A+ or A setup right now? → output TRADE
  2. Are there key institutional zones where a setup could develop? → output WATCH (max 2 zones)
  3. Nothing actionable (choppy, no levels, no bias) → output NO_TRADE

### TACTICAL PHASE
Price has reached a zone you previously flagged. You receive the original watch context.
Decision tree:
  1. Is there a valid entry trigger at this zone NOW (candle pattern, BOS, sweep)? → output TRADE
  2. Is the setup invalidated or conditions not met? → output NO_TRADE with reason

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ANALYTICAL FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### SIGNAL QUALITY TIERS

A+ SETUP — confidence 90-95 (take every time):
✓ D1 + H4 + H1 all aligned in same direction
✓ Fresh liquidity sweep within last 5 bars (stop hunt → reversal)
✓ Price at D1 or H4 OB in OTE zone (62-79% retracement)
✓ Strength-3 candle pattern at the level (Engulfing, Morning/Evening Star)
✓ RSI divergence OR RSI extreme (<30 / >70)
✓ RR ≥ 1:3.5

A SETUP — confidence 83-89 (take if clean):
✓ H4 + H1 aligned (D1 neutral acceptable)
✓ Price at H4 or H1 OB (unmitigated)
✓ Strength-2+ candle confirmation
✓ RSI extreme OR MACD crossover
✓ RR ≥ 1:3.0

B SETUP — confidence 75-82 (only if exceptionally clean):
✓ H4 + H1 aligned
✓ Price at H1 OB or unfilled FVG
✓ Any candle confirmation
✓ RR ≥ 1:2.8
→ When in doubt, output WATCH instead of forcing a B setup.

### ENTRY CONSTRUCTION
- Entry: at OB midpoint or FVG midpoint — never chase price
- SL: 1 pip below OB low (BUY) or above OB high (SELL); minimum 1.5×ATR distance
- TP1: 55% of distance to TP2
- TP2: next major structural level (PDH/PDL/weekly); minimum 1:3.0 RR
- If TP2 at 1:3.0 not achievable → output NO_TRADE or WATCH

### WATCH ZONE RULES
Define zones where the price action has NOT yet developed but institutional interest exists:
- D1 or H4 Order Block that price hasn't reached yet
- Key PDH/PDL/weekly levels with OB confluence
- FVG that has been unmitigated and is below/above current price
- Liquidity pool that is likely to be targeted before reversal
- activateAt: the price level just BEFORE the zone (for BUY: slightly above zoneTop; for SELL: slightly below zoneBottom) — this triggers re-analysis

### MARKET REGIME ADAPTATION
You will receive a detected market regime. Adapt your strategy accordingly:
- trending_up / trending_down (strength ≥ 70): Favor continuation setups. Breakouts from consolidation zones are valid. OBs in the trend direction carry higher weight. Counter-trend setups need A+ confluences.
- ranging (strength 50-69): Favor OB-to-OB fades. Only trade from extreme ends of the range. TP2 = opposite range boundary. Be cautious of false breakouts.
- choppy (strength ≥ 70): Output NO_TRADE or conservative WATCH zones only. Choppy conditions destroy edge. The only valid entry is after a confirmed BOS from the chop.

### D1 MULTI-TIMEFRAME TOP-DOWN PROCESS (mandatory)
Always analyze top-down: D1 → H4 → H1. You will receive actual D1 bar context.
Step 1 (D1): Establish the macro bias. D1 trend = the "law". Only trade with D1 trend, or wait for D1 structure shift.
Step 2 (H4): Find the setup location. H4 OBs and FVGs are the primary entry zones.
Step 3 (H1): Time the exact entry. H1 confirmation (BOS, sweep, pattern) is the trigger.
If any two timeframes conflict, reduce confidence by 15 points. If all three conflict, output NO_TRADE.

### QUALITY GATES (informational — factor into confidence, do not hard-block)
- Session: London (07-17 UTC) and NY (13-22 UTC) produce highest-quality setups. Off-hours reduces quality.
- News: High-impact events within 60 min = reduce confidence significantly or output NO_TRADE.
- Spread: > 0.08% of price = significantly reduces edge, factor into confidence.
- Trend conflict: D1 opposing H4/H1 = reduce confidence or wait for resolution.

### LEARNING FROM PAST TRADES
You will receive lessons from recent completed trades on this instrument. Use them to:
- Avoid repeating documented mistakes
- Recognize patterns that previously worked or failed
- Adjust confidence if the same setup context led to a loss recently

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## OUTPUT FORMATS — strict JSON only, no markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRADE (immediate entry):
{ "status": "TRADE", "side": "BUY"|"SELL", "confidence": <int 75-95>, "entry": <num>, "sl": <num>, "tp1": <num>, "tp2": <num>, "rr": "<str e.g. '3.20'>", "confluences": ["<list each met condition>"], "reasoning": "<4 sentences: (1) D1+H4+H1 alignment verdict, (2) exact OB/FVG level being traded and why valid, (3) sweep/candle pattern context, (4) SL rationale and TP2 target with RR>" }

WATCH (define zones, no immediate entry):
{ "status": "WATCH", "watchZones": [{ "direction": "BUY"|"SELL", "zoneTop": <upper price>, "zoneBottom": <lower price>, "activateAt": <price just outside zone that triggers re-scan>, "reason": "<what makes this zone significant>", "invalidateIf": "<price action that invalidates this zone>" }], "reasoning": "<market overview: what you see, why no entry now, what needs to happen>" }

NO_TRADE (nothing actionable):
{ "status": "NO_TRADE", "reasoning": "<brief: market condition and what would need to change for a setup>" }

ABSOLUTE RULES:
1. Output ONLY valid JSON. No text before or after.
2. WATCH zones: maximum 2. Name only the highest-conviction zones.
3. TRADE confidence minimum 75. Below 75 = output WATCH or NO_TRADE.
4. RR for TP2 must be ≥ 1:3.0. If not achievable = NO_TRADE or WATCH.
5. All price levels must be derived from the actual data provided. Never invent levels.
6. In TACTICAL phase: only TRADE or NO_TRADE. Do not output WATCH.`

// ── User Prompt Builder ────────────────────────────────────────

function buildPrompt(r: AnalyzeRequest): string {
  const d = r.digits
  const bars = r.history.slice(-50)
  const spreadPct = ((r.spread / r.px) * 100).toFixed(3)

  const rsiLabel = r.rsi > 70 ? "OVERBOUGHT" : r.rsi > 60 ? "Elevated" : r.rsi < 30 ? "OVERSOLD" : r.rsi < 40 ? "Depressed" : "Neutral"
  const macdDir  = (r.macdLine ?? 0) > (r.signalLine ?? 0) ? "BULLISH crossover" : "BEARISH crossover"
  const bb       = r.bb ?? { upper: r.px * 1.002, mid: r.px, lower: r.px * 0.998 }
  const bbWidth  = bb.upper - bb.lower
  const bbPos    = bbWidth > 0 ? Math.round((r.px - bb.lower) / bbWidth * 100) : 50
  const bbLabel  = bbPos < 20 ? "Near LOWER band" : bbPos > 80 ? "Near UPPER band" : "Mid-range"

  const htf      = r.htf ?? { trend: "NEUTRAL", rsi: 50, support: [], resistance: [], lastClose: r.px, lastBarBullish: true }
  const htfRsiLabel = htf.rsi > 65 ? "overbought" : htf.rsi < 35 ? "oversold" : "neutral"
  const atrSL    = (r.atr * 1.5).toFixed(d)

  const patterns = r.candlePatterns.filter(cp => cp.type !== "neutral")
  const patternStr = patterns.length > 0
    ? patterns.map(cp => `${cp.name} (${cp.type}, strength ${cp.strength}/3)`).join(", ")
    : "None detected"

  const ohlcv = bars.slice(-15).map(b =>
    `${new Date(b.time * 1000).toISOString().slice(11, 16)} O:${b.open.toFixed(d)} H:${b.high.toFixed(d)} L:${b.low.toFixed(d)} C:${b.close.toFixed(d)}`
  ).join("\n")

  const smc = r.smc ?? {
    structure: { bias: "RANGING" as const, zone: "EQUILIBRIUM" as const, inOTE: false, lastBOS: null, recentSwingHigh: r.px * 1.01, recentSwingLow: r.px * 0.99 },
    orderBlocks: [], h4OrderBlocks: [], fvgs: [], liquidity: [], sweeps: [], divergence: null,
    daily: { pdHigh: r.px * 1.005, pdLow: r.px * 0.995, weekHigh: r.px * 1.01, weekLow: r.px * 0.99, d1Bias: "NEUTRAL", d1OBs: [] },
  }
  const struct = smc.structure
  const swingRange = struct.recentSwingHigh - struct.recentSwingLow
  const pos = swingRange > 0 ? Math.round(((r.px - struct.recentSwingLow) / swingRange) * 100) : 50
  const lastBOSStr = struct.lastBOS
    ? `${struct.lastBOS.kind} ${struct.lastBOS.direction} at ${struct.lastBOS.price.toFixed(d)}`
    : "None detected"

  const obLines = smc.orderBlocks.length > 0
    ? smc.orderBlocks.map(ob =>
        `  H1 ${ob.type.toUpperCase()} OB: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)} | str ${"★".repeat(ob.strength)}${"☆".repeat(3 - ob.strength)}`
      ).join("\n")
    : "  None"

  const h4ObLines = smc.h4OrderBlocks?.length > 0
    ? smc.h4OrderBlocks.map(ob =>
        `  H4 ${ob.type.toUpperCase()} OB: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)} | str ${"★".repeat(ob.strength)}${"☆".repeat(3 - ob.strength)}`
      ).join("\n")
    : "  None"

  const sweepLines = smc.sweeps?.length > 0
    ? smc.sweeps.map(sw =>
        `  ⚡ ${sw.type.toUpperCase()} SWEEP: ${sw.level.toFixed(d)} | ${sw.barsAgo} bar${sw.barsAgo !== 1 ? "s" : ""} ago | str ${"★".repeat(sw.strength)}${"☆".repeat(3 - sw.strength)}${sw.barsAgo <= 3 ? " ← VERY FRESH" : sw.barsAgo <= 8 ? " ← Fresh" : ""}`
      ).join("\n")
    : "  None"

  const daily = smc.daily
  const d1ObLines = daily?.d1OBs?.length > 0
    ? daily.d1OBs.map(ob =>
        `  D1 ${ob.type.toUpperCase()} OB ★★★★: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)}`
      ).join("\n")
    : "  None"

  const divLine = smc.divergence
    ? `  ${smc.divergence.type.toUpperCase()} RSI DIVERGENCE (${smc.divergence.strength}) — strong momentum signal`
    : "  None"

  const fvgLines = smc.fvgs.length > 0
    ? smc.fvgs.map(fvg =>
        `  ${fvg.type.toUpperCase()} FVG: ${fvg.bottom.toFixed(d)}–${fvg.top.toFixed(d)} | mid ${fvg.mid.toFixed(d)}`
      ).join("\n")
    : "  None"

  const liqLines = smc.liquidity.length > 0
    ? smc.liquidity.map(lv =>
        `  ${lv.type === "buyside" ? "BSL" : "SSL"}: ${lv.price.toFixed(d)} (${lv.touches} touches)`
      ).join("\n")
    : "  None"

  const sessionStr = r.activeSessions.length > 0 ? r.activeSessions.join(", ") : "Off-hours"

  const newsStr = r.upcomingNews?.length
    ? r.upcomingNews.map(n => `  ${n.event} in ${n.minsUntil}m (${n.impact} impact)`).join("\n")
    : "  None in next 2 hours"

  // Tactical phase context
  const tacticalBlock = r.phase === "tactical" && r.watchContext?.length
    ? `\n=== TACTICAL CONFIRMATION — ZONE REACHED ===
You previously flagged these zones. Price is now at or near them.
${r.watchContext.map(z =>
  `  ${z.direction} ZONE: ${z.zoneBottom.toFixed(d)}–${z.zoneTop.toFixed(d)} | activateAt: ${z.activateAt.toFixed(d)}
  Reason: ${z.reason}
  Invalidate if: ${z.invalidateIf}`
).join("\n")}
Your task: Is there a valid entry trigger NOW (candle pattern, fresh BOS, sweep at zone)? → TRADE or NO_TRADE.`
    : ""

  // Market regime string
  const regimeLabel = r.regime
    ? `${r.regime.replace("_", " ").toUpperCase()} (strength ${r.regimeStrength ?? "?"}%)`
    : "Unknown"

  // D1 context block
  const d1Block = r.d1Context ? `
=== D1 MACRO CONTEXT (top-down step 1) ===
D1 Trend:   ${r.d1Context.trend} | D1 Regime: ${r.d1Context.regime.replace("_", " ").toUpperCase()}
D1 RSI:     ${r.d1Context.rsi.toFixed(1)} | Last D1 bar: ${r.d1Context.lastBarBullish ? "BULLISH" : "BEARISH"} close at ${r.d1Context.lastClose.toFixed(d)}
Week Range: ${r.d1Context.weekLow.toFixed(d)} – ${r.d1Context.weekHigh.toFixed(d)}
Month Range:${r.d1Context.monthLow.toFixed(d)} – ${r.d1Context.monthHigh.toFixed(d)}
D1 Support:    ${r.d1Context.support.length ? r.d1Context.support.map(l => l.toFixed(d)).join(" | ") : "None"}
D1 Resistance: ${r.d1Context.resistance.length ? r.d1Context.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}`
    : "\n=== D1 MACRO CONTEXT ===\nNo D1 data available — rely on SMC daily context."

  // Lessons block
  const lessonsBlock = r.lessons?.length
    ? `\n=== LESSONS FROM RECENT TRADES ON ${r.sym} ===
${r.lessons.map((l, i) => `[${i+1}] ${l.outcome} (${l.pnl_r > 0 ? "+" : ""}${l.pnl_r.toFixed(2)}R) ${l.side}
  Lesson: ${l.lesson}
  Mistakes: ${l.mistakes.join("; ") || "None"}
  Next time: ${l.nextTime}`).join("\n")}`
    : ""

  return `=== PHASE: ${r.phase === "tactical" ? "TACTICAL CONFIRMATION" : "STRATEGIC ANALYSIS"} ===
${r.phase === "strategic"
  ? "Perform full analysis. Identify an immediate setup (TRADE), zones to monitor (WATCH), or output NO_TRADE."
  : "Price reached a flagged zone. Confirm or reject the setup."}
${tacticalBlock}
${lessonsBlock}

=== INSTRUMENT ===
Symbol:    ${r.sym}
Price:     ${r.px.toFixed(d)}
Timeframe: ${r.timeframe} (all entry levels must be valid on this timeframe)
Spread:    ${r.spread} (${spreadPct}% of price)
Strategy:  ${r.skillset}
Regime:    ${regimeLabel}

=== SESSION & NEWS CONTEXT (factor into confidence) ===
Session:  ${sessionStr}
Upcoming: ${newsStr}
${d1Block}

=== INTRADAY REFERENCE LEVELS ===
D1 Bias: ${daily?.d1Bias ?? "N/A"} | PDH: ${daily?.pdHigh?.toFixed(d) ?? "N/A"} | PDL: ${daily?.pdLow?.toFixed(d) ?? "N/A"}
D1 Order Blocks (from SMC):
${d1ObLines}

=== LIQUIDITY SWEEPS ===
${sweepLines}

=== RSI DIVERGENCE ===
${divLine}

=== H4 STRUCTURE ===
Trend: ${htf.trend} | RSI: ${htf.rsi.toFixed(1)} (${htfRsiLabel})
Resistance: ${htf.resistance.length > 0 ? htf.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}
Support:    ${htf.support.length > 0 ? htf.support.map(l => l.toFixed(d)).join(" | ") : "None"}
H4 Order Blocks:
${h4ObLines}

=== H1 SMART MONEY ANALYSIS ===
Structure: ${struct.bias} | Zone: ${struct.zone}${struct.inOTE ? " ★ OTE" : ""} (${pos}% of swing ${struct.recentSwingLow.toFixed(d)}–${struct.recentSwingHigh.toFixed(d)})
Last BOS:  ${lastBOSStr}

H1 Order Blocks:
${obLines}

Fair Value Gaps:
${fvgLines}

Liquidity Pools:
${liqLines}

=== H1 INDICATORS ===
RSI(14):  ${r.rsi.toFixed(1)} → ${rsiLabel}
MACD:     Line ${r.macdLine.toFixed(d + 1)} | Signal ${r.signalLine.toFixed(d + 1)} → ${macdDir}
BB(20,2): ${bbPos}% position → ${bbLabel}
ATR(14):  ${r.atr.toFixed(d)} | 1.5×ATR SL distance: ${atrSL}
EMA Trend: ${r.trend}

=== CANDLE PATTERNS (last 5 bars) ===
${patternStr}

=== RECENT OHLCV (last 15 H1 bars) ===
${ohlcv}`
}

// ── JSON extraction ────────────────────────────────────────────

function extractResult(text: string): AIResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("No JSON found in AI response")
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(match[0])
  } catch {
    throw new Error(`AI returned invalid JSON: ${match[0].slice(0, 120)}`)
  }

  // Normalize old format (side: "BUY"/"SELL"/"NO TRADE") to new status format
  if (!obj.status) {
    if (obj.side === "NO TRADE" || obj.side === "NO_TRADE") {
      obj.status = "NO_TRADE"
    } else if (obj.side === "BUY" || obj.side === "SELL") {
      obj.status = "TRADE"
    } else {
      obj.status = "NO_TRADE"
    }
  }

  if (!Array.isArray(obj.confluences)) obj.confluences = []
  if (!obj.reasoning && obj.reason) obj.reasoning = obj.reason

  return obj as unknown as AIResult
}

// ── Provider Calls ─────────────────────────────────────────────

async function callAnthropic(r: AnalyzeRequest): Promise<AIResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": r.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: r.model,
      max_tokens: 800,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: buildPrompt(r) }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()

  const usage = data.usage ?? {}
  const cacheRead    = usage.cache_read_input_tokens    ?? 0
  const cacheCreated = usage.cache_creation_input_tokens ?? 0
  const hit = cacheRead > 0

  const result = extractResult(data.content[0].text)
  result._cache = { hit, savedTokens: hit ? cacheRead : cacheCreated }
  return result
}

async function callOpenAI(r: AnalyzeRequest): Promise<AIResult> {
  const isReasoning = r.model.startsWith("o")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${r.apiKey}` },
    body: JSON.stringify({
      model: r.model,
      ...(isReasoning ? {} : { temperature: 0.2 }),
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildPrompt(r) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractResult(data.choices[0].message.content)
}

async function callDeepSeek(r: AnalyzeRequest): Promise<AIResult> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${r.apiKey}` },
    body: JSON.stringify({
      model: r.model,
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildPrompt(r) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractResult(data.choices[0].message.content)
}

async function callGemini(r: AnalyzeRequest): Promise<AIResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${r.model}:generateContent?key=${r.apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: buildPrompt(r) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractResult(data.candidates[0].content.parts[0].text)
}

// ── Route Handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()

    // Fetch API key from DB — never trust the client-supplied value
    const keyRecord = await dbGetAPIKey(raw.provider)
    if (!keyRecord) {
      return NextResponse.json({ error: "No API key configured for this provider" }, { status: 401 })
    }
    const body: AnalyzeRequest = {
      ...raw,
      apiKey: keyRecord.apiKey,
      model: raw.model || keyRecord.model,
    }

    let result: AIResult

    switch (body.provider) {
      case "anthropic": result = await callAnthropic(body); break
      case "openai":    result = await callOpenAI(body);    break
      case "deepseek":  result = await callDeepSeek(body);  break
      case "gemini":    result = await callGemini(body);    break
      default:
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

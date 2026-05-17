import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

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

interface AnalyzeRequest {
  provider: "anthropic" | "openai" | "deepseek" | "gemini"
  model: string
  apiKey: string
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
}

interface SignalResult {
  side: "BUY" | "SELL" | "NO TRADE"
  confidence: number
  entry: number
  sl: number
  tp1: number
  tp2: number
  rr: string
  confluences: string[]
  reasoning: string
  _cache?: { hit: boolean; savedTokens: number }
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite institutional trading desk analyst. Your mandate is simple: identify ONLY the highest-probability Smart Money setups that a professional prop trader would stake real capital on. You will output NO TRADE the overwhelming majority of the time. Precision over frequency — one A+ signal per week beats 20 mediocre ones.

## ABSOLUTE PREREQUISITES — ALL must be true or the answer is NO TRADE

**P1 — Session (hard gate, no exceptions):**
Active London session (08:00-17:00 UTC) OR active New York session (13:00-22:00 UTC). Outside these windows, institutional liquidity is insufficient. Return NO TRADE immediately without further analysis.

**P2 — 3-Timeframe Alignment:**
D1 bias, H4 structure, and H1 structure must all point in the same direction. Two out of three is acceptable ONLY if the dissenting TF is NEUTRAL (not opposing). A fully opposing TF = NO TRADE.

**P3 — Price at an Institutional Level:**
Price must be within 0.3×ATR of one of these levels (in priority order):
  1. D1 Order Block (strongest — where large banks positioned)
  2. H4 Order Block (strong — high timeframe institutional interest)
  3. H1 Order Block (entry-grade — confirmed unmitigated)
  4. Unfilled Fair Value Gap (imbalance that must be corrected)
  NOT at a level = NO TRADE. Price chasing = NO TRADE.

**P4 — Correct Market Zone:**
- BUY: price must be in DISCOUNT zone (<50% of swing range) or OTE (62-79% retracement)
- SELL: price must be in PREMIUM zone (>50% of swing range) or OTE
Price at equilibrium (45-55%) with no OB/FVG = NO TRADE.

**P5 — Candle Confirmation (required, not optional):**
A reversal candle pattern at the level is mandatory for signal issuance:
- Strength 3 (A+): Bullish/Bearish Engulfing, Morning/Evening Star, Three Soldiers/Crows
- Strength 2 (A): Hammer, Shooting Star, Pin Bar, Doji with strong wick rejection
- Strength 1: Not sufficient on its own — needs sweep or divergence as substitute
No candle confirmation at the level = downgrade confidence by 15 points minimum.

## SIGNAL QUALITY TIERS

### A+ SETUP — confidence 90-95 (take every time):
✓ D1 + H4 + H1 all aligned
✓ Fresh liquidity sweep within last 5 bars (stop hunt → reversal)
✓ Price at D1 or H4 OB in OTE zone (62-79% retracement)
✓ Strength-3 candle pattern at the level
✓ RSI divergence OR RSI extreme (<30 / >70)
✓ Active London-NY overlap (13:00-17:00 UTC) — highest volume
✓ RR ≥ 1:3.5

### A SETUP — confidence 83-89 (take if spread acceptable):
✓ H4 + H1 aligned (D1 neutral acceptable)
✓ Price at H4 or H1 OB (unmitigated, strength 2-3)
✓ Strength-2+ candle pattern at level
✓ RSI extreme OR MACD crossover confirmed
✓ Active London or NY session
✓ RR ≥ 1:3.0

### B SETUP — confidence 75-82 (marginal — tighten sizing):
✓ H4 + H1 aligned
✓ Price at H1 OB or unfilled FVG
✓ Any candle confirmation
✓ One classical indicator confirmation
✓ Active session
✓ RR ≥ 1:2.8
→ Only issue B setups if the data is exceptionally clean. When in doubt, NO TRADE.

## TRADE CONSTRUCTION RULES
- Entry: at the OB midpoint or FVG midpoint — NEVER above/below the level
- SL: 1 pip below the OB low (BUY) or 1 pip above the OB high (SELL); minimum 1.5×ATR distance
- TP1: exactly 55% of the distance from entry to TP2
- TP2: next major structural level (swing high/low, PDH/PDL, weekly level) — minimum 1:3.0 RR; if not achievable = NO TRADE
- Spread check: if spread > 0.08% of price → NO TRADE (execution slippage kills the edge)

## LIQUIDITY SWEEP BONUS
A sweep within the last 5 bars where price wicked through a key level and reversed closes:
- Sell-side sweep (equal lows broken, close above) → BUY signal potential — confidence +12 points
- Buy-side sweep (equal highs broken, close below) → SELL signal potential — confidence +12 points
Sweep + OB + candle = the highest-quality setup possible. Prioritize these above all.

## OUTPUT — strict JSON only, no markdown, no explanation outside the JSON:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <integer 0-100>,
  "entry": <number — OB/FVG midpoint>,
  "sl": <number — beyond OB extreme, min 1.5×ATR>,
  "tp1": <number — 55% of TP2 distance>,
  "tp2": <number — structural target, min 1:3.0 RR>,
  "rr": "<string e.g. '3.20'>",
  "confluences": [<list every met condition: structure, zone, OB/FVG details, sweep, candle pattern, RSI, session>],
  "reasoning": "<exactly 4 sentences: (1) D1+H4+H1 structure alignment verdict, (2) exact OB/FVG level being traded and why it is valid/unmitigated, (3) liquidity context — sweep or lack thereof — plus candle pattern name and what it signals, (4) SL placement rationale and TP2 structural target with RR>"
}`

// ── User Prompt Builder ────────────────────────────────────────

function buildPrompt(r: AnalyzeRequest): string {
  const d = r.digits
  const bars = r.history.slice(-50)
  const spreadPct = ((r.spread / r.px) * 100).toFixed(3)

  const rsiLabel = r.rsi > 70 ? "OVERBOUGHT" : r.rsi > 60 ? "Elevated" : r.rsi < 30 ? "OVERSOLD" : r.rsi < 40 ? "Depressed" : "Neutral"
  const macdDir  = r.macdLine > r.signalLine ? "BULLISH crossover" : "BEARISH crossover"
  const bbWidth  = r.bb.upper - r.bb.lower
  const bbPos    = bbWidth > 0 ? Math.round((r.px - r.bb.lower) / bbWidth * 100) : 50
  const bbLabel  = bbPos < 20 ? "Near LOWER band — reversal zone" : bbPos > 80 ? "Near UPPER band — reversal zone" : "Mid-range"

  const htfRsiLabel = r.htf.rsi > 65 ? "overbought" : r.htf.rsi < 35 ? "oversold" : "neutral"
  const atrSL    = (r.atr * 1.5).toFixed(d)

  const patterns = r.candlePatterns.filter(cp => cp.type !== "neutral")
  const patternStr = patterns.length > 0
    ? patterns.map(cp => `${cp.name} (${cp.type}, strength ${cp.strength}/3)`).join(", ")
    : "None detected"

  const ohlcv = bars.slice(-15).map(b =>
    `${new Date(b.time * 1000).toISOString().slice(11, 16)} O:${b.open.toFixed(d)} H:${b.high.toFixed(d)} L:${b.low.toFixed(d)} C:${b.close.toFixed(d)}`
  ).join("\n")

  // SMC formatting
  const smc = r.smc
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
    : "  None detected"

  const h4ObLines = smc.h4OrderBlocks?.length > 0
    ? smc.h4OrderBlocks.map(ob =>
        `  H4 ${ob.type.toUpperCase()} OB ★★★: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)} | str ${"★".repeat(ob.strength)}${"☆".repeat(3 - ob.strength)}`
      ).join("\n")
    : "  None detected"

  const sweepLines = smc.sweeps?.length > 0
    ? smc.sweeps.map(sw =>
        `  ⚡ ${sw.type.toUpperCase()} SWEEP: ${sw.level.toFixed(d)} | ${sw.barsAgo} bar${sw.barsAgo !== 1 ? "s" : ""} ago | str ${"★".repeat(sw.strength)}${"☆".repeat(3 - sw.strength)}${sw.barsAgo <= 3 ? " ← VERY FRESH" : sw.barsAgo <= 8 ? " ← Fresh" : ""}`
      ).join("\n")
    : "  None detected — no recent stop hunt"

  const daily = smc.daily
  const d1ObLines = daily?.d1OBs?.length > 0
    ? daily.d1OBs.map(ob =>
        `  D1 ${ob.type.toUpperCase()} OB ★★★★: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)}`
      ).join("\n")
    : "  None"

  const divLine = smc.divergence
    ? `  ${smc.divergence.type.toUpperCase()} RSI DIVERGENCE (${smc.divergence.strength}) — strong momentum signal`
    : "  None detected"

  const fvgLines = smc.fvgs.length > 0
    ? smc.fvgs.map(fvg =>
        `  ${fvg.type.toUpperCase()} FVG: ${fvg.bottom.toFixed(d)}–${fvg.top.toFixed(d)} | mid ${fvg.mid.toFixed(d)}`
      ).join("\n")
    : "  None detected"

  const liqLines = smc.liquidity.length > 0
    ? smc.liquidity.map(lv =>
        `  ${lv.type === "buyside" ? "BSL" : "SSL"}: ${lv.price.toFixed(d)} (${lv.touches} touches)`
      ).join("\n")
    : "  None detected"

  const sessionStr = r.activeSessions.length > 0 ? r.activeSessions.join(", ") : "None — off-hours"

  return `=== INSTRUMENT ===
Symbol:        ${r.sym}
Current Price: ${r.px.toFixed(d)}
Spread:        ${r.spread} (${spreadPct}% of price)${parseFloat(spreadPct) > 0.08 ? " ← SPREAD TOO HIGH → NO TRADE" : ""}
Strategy:      ${r.skillset}

=== GATE CHECK (answer these first — any NO = return NO TRADE immediately) ===
G1 Session: ${sessionStr} — London (08-17 UTC) or NY (13-22 UTC) required. Currently: ${sessionStr.includes("London") || sessionStr.includes("New York") ? "✓ PASS" : "✗ FAIL → NO TRADE"}
G2 Alignment: D1=${daily?.d1Bias ?? "N/A"}, H4=${r.htf.trend}, H1=${struct.bias} — need 3/3 aligned or 2/3 with neutral dissenter.
G3 Spread: ${spreadPct}% — must be <0.08%. ${parseFloat(spreadPct) > 0.08 ? "✗ FAIL → NO TRADE" : "✓ PASS"}

=== DAILY CONTEXT (D1 — highest TF, institutional positioning) ===
D1 Bias:      ${daily?.d1Bias ?? "N/A"} (3-day direction of closes)
PDH:          ${daily?.pdHigh?.toFixed(d) ?? "N/A"} ← previous day high (institutional resistance / BSL)
PDL:          ${daily?.pdLow?.toFixed(d) ?? "N/A"} ← previous day low (institutional support / SSL)
Weekly Range: ${daily?.weekLow?.toFixed(d) ?? "N/A"} – ${daily?.weekHigh?.toFixed(d) ?? "N/A"}
D1 Order Blocks (highest-weight levels — price reacts to these for days):
${d1ObLines}

=== LIQUIDITY SWEEPS — highest quality setup trigger ===
${sweepLines}

=== RSI DIVERGENCE ===
${divLine}

=== H4 STRUCTURE ===
H4 Trend:      ${r.htf.trend} ← primary direction filter
H4 RSI:        ${r.htf.rsi.toFixed(1)} (${htfRsiLabel})
H4 Resistance: ${r.htf.resistance.length > 0 ? r.htf.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}
H4 Support:    ${r.htf.support.length > 0 ? r.htf.support.map(l => l.toFixed(d)).join(" | ") : "None"}
H4 Order Blocks (strong entry zones — institutional interest):
${h4ObLines}

=== H1 SMART MONEY ANALYSIS ===
Structure:  ${struct.bias} | Zone: ${struct.zone}${struct.inOTE ? " ★ OTE ZONE" : ""} (${pos}% of swing range ${struct.recentSwingLow.toFixed(d)} → ${struct.recentSwingHigh.toFixed(d)})
Last Break: ${lastBOSStr}

H1 Order Blocks (unmitigated, nearest first):
${obLines}

Fair Value Gaps (unfilled):
${fvgLines}

Liquidity Pools:
${liqLines}

=== H1 INDICATORS ===
RSI(14):   ${r.rsi.toFixed(1)} → ${rsiLabel}
MACD:      Line ${r.macdLine.toFixed(d + 1)} | Signal ${r.signalLine.toFixed(d + 1)} | Hist ${r.histogram.toFixed(d + 1)} → ${macdDir}
BB(20,2):  Upper ${r.bb.upper.toFixed(d)} Mid ${r.bb.mid.toFixed(d)} Lower ${r.bb.lower.toFixed(d)} | ${bbPos}% position → ${bbLabel}
EMA Trend: ${r.trend} | ATR(14): ${r.atr.toFixed(d)} | 1.5×ATR SL: ${atrSL}

=== CANDLE PATTERNS (last 5 bars — confirmation required) ===
${patternStr}

=== RECENT OHLCV (last 15 H1 bars, newest last) ===
${ohlcv}

=== DECISION CHECKLIST — work through in order, stop at first failure ===
STEP 1 — Session gate: Is London or NY active? ${sessionStr.includes("London") || sessionStr.includes("New York") ? "YES → continue" : "NO → output NO TRADE, stop here."}
STEP 2 — Alignment: Are D1+H4+H1 aligned (or 2/3 with neutral)? State which direction or conflict.
STEP 3 — Level: Is price within 0.3×ATR (${(r.atr * 0.3).toFixed(d)}) of a D1 OB, H4 OB, H1 OB, or FVG? If no level nearby → NO TRADE.
STEP 4 — Zone: DISCOUNT for BUY, PREMIUM for SELL. OTE zone is ideal. Mid-range without OB/FVG → NO TRADE.
STEP 5 — Sweep: ${smc.sweeps?.length > 0 ? `SWEEP DETECTED — ${smc.sweeps[0].type.toUpperCase()} sweep ${smc.sweeps[0].barsAgo} bars ago → +12 confidence if aligns with trade direction.` : "No sweep — check OB/FVG carefully."}
STEP 6 — Candle: Is there a strength-2+ reversal pattern at the level? ${patterns.length > 0 ? `YES: ${patternStr}` : "NO — reduce confidence by 15 if issuing a signal."}
STEP 7 — RR: Can TP2 reach at least 1:3.0 at the next structural level (PDH=${daily?.pdHigh?.toFixed(d) ?? "N/A"}, PDL=${daily?.pdLow?.toFixed(d) ?? "N/A"}, weekly H/L)? If RR < 3.0 → NO TRADE.
STEP 8 — Final verdict: Signal only if steps 1-7 all pass. Elite setup (A+) = sweep + aligned OB + candle + RSI extreme → confidence 90+. Standard (A) = OB + candle + session → confidence 83-89. When any doubt exists → NO TRADE.`
}

// ── JSON extraction helper ─────────────────────────────────────

function extractJSON(text: string): SignalResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("No JSON found in response")
  const obj = JSON.parse(match[0])
  // Normalize: ensure confluences array exists
  if (!Array.isArray(obj.confluences)) obj.confluences = []
  // Map "reasoning" alt key
  if (!obj.reasoning && obj.reason) obj.reasoning = obj.reason
  return obj as SignalResult
}

// ── Provider Calls ─────────────────────────────────────────────

async function callAnthropic(r: AnalyzeRequest): Promise<SignalResult> {
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
      max_tokens: 600,
      // System prompt as array with cache_control — Anthropic caches this block
      // for ~5 min (ephemeral). All parallel pair scans within that window reuse
      // the cached tokens, cutting input cost by ~80% and latency by ~200ms.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
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

  const result = extractJSON(data.content[0].text)
  result._cache = { hit, savedTokens: hit ? cacheRead : cacheCreated }
  return result
}

async function callOpenAI(r: AnalyzeRequest): Promise<SignalResult> {
  const isReasoning = r.model.startsWith("o")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${r.apiKey}` },
    body: JSON.stringify({
      model: r.model,
      ...(isReasoning ? {} : { temperature: 0.2 }),
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildPrompt(r) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.choices[0].message.content)
}

async function callDeepSeek(r: AnalyzeRequest): Promise<SignalResult> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${r.apiKey}` },
    body: JSON.stringify({
      model: r.model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildPrompt(r) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.choices[0].message.content)
}

async function callGemini(r: AnalyzeRequest): Promise<SignalResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${r.model}:generateContent?key=${r.apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: buildPrompt(r) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.candidates[0].content.parts[0].text)
}

// ── Route Handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()

    if (!body.apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 })
    }

    let result: SignalResult

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

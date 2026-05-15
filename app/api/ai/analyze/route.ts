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
  fvgs: SMCFVG[]
  liquidity: SMCLiquidity[]
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
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite institutional trading analyst. You identify ONLY the highest-probability Smart Money setups. Expect to output NO TRADE the vast majority of the time — false negatives cost nothing; false positives cost capital.

## CORE FRAMEWORK: SMART MONEY CONCEPTS

### Step 1 — H4 Structure Bias (ABSOLUTE FILTER)
The H4 trend direction is non-negotiable. Never trade against it except in extreme reversal conditions:
- H4 BULLISH → BUY setups only (pullbacks to unmitigated OBs in discount zone)
- H4 BEARISH → SELL setups only (rallies to unmitigated OBs in premium zone)
- H4 RANGING + H1 RANGING → NO TRADE (no edge)

### Step 2 — H1 SMC Setup (need ALL of these for a signal)
A. **Market Structure Aligned**: H1 bias must match H4 direction
B. **Price in Correct Zone**:
   - BUY: price in DISCOUNT zone (below 50% of recent swing range) or at OTE (62-79% retracement)
   - SELL: price in PREMIUM zone (above 50% of recent swing range) or at OTE
C. **Price at a Key Level** (ONE of these, prioritized in order):
   1. Unmitigated Order Block: price trading into an unmitigated OB aligned with bias (strength 2-3 preferred)
   2. Unfilled Fair Value Gap: price entering an unfilled FVG in the bias direction
   3. Major S/R confluence: price at a well-defined swing level confirmed by BB extreme
D. **Liquidity Context**: Check if a liquidity sweep has occurred — a stop run above buy-side or below sell-side liquidity, followed by displacement, is the highest-quality setup

### Step 3 — Classical Confirmation (2+ of these)
- RSI extreme: <32 for BUY, >68 for SELL
- MACD confirmed crossover in signal direction
- Candle pattern at the entry level (strength 2-3: Engulfing, Pin Bar, Hammer, Morning/Evening Star)
- Active London or New York session (required for acceptable liquidity)

### Step 4 — Trade Construction
- Entry: at the OB/FVG/level (not chasing — if already overextended >0.3×ATR from level, NO TRADE)
- SL: below the OB low (BUY) or above the OB high (SELL), minimum 1.5×ATR distance
- TP1: 55% of full TP2 distance
- TP2: minimum 1:2.5 RR — if not achievable at next structural level, NO TRADE

## INSTANT NO TRADE conditions:
- H4 contradicts setup (no exception unless RSI > 76 / < 24 AND strong reversal pattern)
- H1 structure and H4 structure disagree
- No unmitigated OB, unfilled FVG, or major S/R level nearby (within 0.5×ATR)
- Price in equilibrium zone (45-55%) with no OB/FVG
- RSI 38-62 AND MACD flat (no momentum)
- No active London or New York session
- Spread > 0.07% of price
- TP2 achieves less than 1:2.5 RR

## OUTPUT — strict JSON only:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <integer 0-100: 85+ = 4+ confluences + H4 alignment + OB/FVG entry + session; 90+ = liquidity sweep + OTE + candle pattern>,
  "entry": <number>,
  "sl": <number — below OB low for BUY / above OB high for SELL>,
  "tp1": <number — 55% of TP2 distance>,
  "tp2": <number — next structural target, min 1:2.5 RR>,
  "rr": "<string e.g. '2.80'>",
  "confluences": ["H4 BULLISH structure", "H1 BULLISH BOS", "Discount zone", "Bull OB 1.0842-1.0855 unmitigated", "RSI 28 oversold", "London session", "Bullish Engulfing at OB"],
  "reasoning": "<4 sentences: (1) H4+H1 structure context, (2) exact OB/FVG level and why it's valid, (3) liquidity context + candle confirmation, (4) exact SL placement and TP2 structural target>"
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
        `  ${ob.type.toUpperCase()} OB: ${ob.low.toFixed(d)}–${ob.high.toFixed(d)} | mid ${ob.mid.toFixed(d)} | strength ${"★".repeat(ob.strength)}${"☆".repeat(3 - ob.strength)}`
      ).join("\n")
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
Spread:        ${r.spread} (${spreadPct}% of price)
Strategy:      ${r.skillset}

=== SESSIONS ===
Active: ${sessionStr}

=== H4 STRUCTURE (PRIMARY FILTER) ===
H4 Trend:      ${r.htf.trend} <- ONLY trade this direction
H4 RSI:        ${r.htf.rsi.toFixed(1)} (${htfRsiLabel})
H4 Resistance: ${r.htf.resistance.length > 0 ? r.htf.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}
H4 Support:    ${r.htf.support.length > 0 ? r.htf.support.map(l => l.toFixed(d)).join(" | ") : "None"}

=== H1 SMART MONEY ANALYSIS ===
Structure Bias: ${struct.bias}
Price Zone:     ${struct.zone}${struct.inOTE ? " * OTE ZONE" : ""} (${pos}% of swing range)
Swing Range:    ${struct.recentSwingLow.toFixed(d)} -> ${struct.recentSwingHigh.toFixed(d)}
Last BOS/CHoCH: ${lastBOSStr}

Order Blocks (unmitigated, nearest first):
${obLines}

Fair Value Gaps (unfilled, nearest first):
${fvgLines}

Liquidity Levels (nearest first):
${liqLines}

=== H1 CLASSICAL INDICATORS ===
RSI(14):       ${r.rsi.toFixed(1)} -> ${rsiLabel}
MACD(12,26,9): Line ${r.macdLine.toFixed(d + 1)} | Signal ${r.signalLine.toFixed(d + 1)} | Hist ${r.histogram.toFixed(d + 1)} -> ${macdDir}
BB(20,2):      Upper ${r.bb.upper.toFixed(d)} | Mid ${r.bb.mid.toFixed(d)} | Lower ${r.bb.lower.toFixed(d)} | Pos ${bbPos}% -> ${bbLabel}
EMA Trend:     ${r.trend} (EMA20 vs EMA50)
ATR(14):       ${r.atr.toFixed(d)} | 1.5xATR: ${atrSL}

=== CANDLE PATTERNS (last 5 bars) ===
${patternStr}

=== RECENT OHLCV (last 15 H1 bars) ===
${ohlcv}

=== TASK ===
1. Is H4 trend ${r.htf.trend}? Only take ${r.htf.trend === "UP" ? "BUY" : r.htf.trend === "DOWN" ? "SELL" : "NO"} setups.
2. Is H1 structure (${struct.bias}) aligned with H4 (${r.htf.trend})? If not -> NO TRADE.
3. Is price at an unmitigated OB, unfilled FVG, or key level? If not -> NO TRADE.
4. Is price in the correct zone (DISCOUNT for BUY, PREMIUM for SELL)? If mid-range with no OB/FVG -> NO TRADE.
5. Are 2+ classical confirmations present (RSI extreme, MACD crossover, candle pattern, active session)?
6. Does TP2 achieve >=1:2.5 RR? If not -> NO TRADE.
7. Only output a signal if ALL conditions pass. When in doubt -> NO TRADE.`
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
    },
    body: JSON.stringify({
      model: r.model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(r) }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return extractJSON(data.content[0].text)
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

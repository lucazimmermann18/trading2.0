import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

interface OHLCV { time: number; open: number; high: number; low: number; close: number }

interface CandlePattern { name: string; type: "bullish" | "bearish" | "neutral"; strength: number }
interface HTFContext {
  trend: "UP" | "DOWN" | "NEUTRAL"; rsi: number
  support: number[]; resistance: number[]
  lastClose: number; lastBarBullish: boolean
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
  // new: ATR, candle patterns, H4 context
  atr: number
  candlePatterns: CandlePattern[]
  htf: HTFContext
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

const SYSTEM_PROMPT = `You are an elite institutional trading signal engine. Your sole purpose is to identify ONLY the highest-probability setups that professional prop-desk traders would take. The bar is extremely high — output NO TRADE in 80%+ of cases. A missed opportunity costs nothing; a low-quality signal costs real capital.

## ANALYSIS FRAMEWORK

### Step 1 — Higher Timeframe Bias (H4) — ABSOLUTE REQUIREMENT
The H4 trend is the PRIMARY filter. Any setup that contradicts it is an automatic NO TRADE.
- H4 UP → BUY setups only. Exception: H4 RSI > 74 AND price rejected from a major H4 resistance zone with a strong bearish candle pattern.
- H4 DOWN → SELL setups only. Exception: H4 RSI < 26 AND price holding a major H4 support zone with a strong bullish candle pattern.
- H4 NEUTRAL → Output NO TRADE unless 5+ independent H1 confluences align perfectly.

### Step 2 — Entry Timeframe Confluence (H1) — MINIMUM 4 REQUIRED
Count ONLY clear, unambiguous signals. Do NOT stretch to reach the minimum:
1. RSI extreme: < 32 oversold (BUY) or > 68 overbought (SELL) — "near 40" does NOT count
2. MACD confirmed crossover with histogram momentum in signal direction
3. Bollinger Band: price at or beyond the outer band (< 10% BB position for BUY, > 90% for SELL)
4. Price within 0.3×ATR of a clearly defined swing S/R or H4 structural level
5. EMA trend alignment: EMA20 decisively above/below EMA50 (separation > 0.15% of price)
6. Active London or New York session — Tokyo/Sydney alone are NOT sufficient
7. Candle pattern confirmation at a key level (strength 2 or 3 only — Doji/Inside Bar do NOT count)

### Step 3 — Candle Pattern Confirmation
High-conviction patterns that count as confluence #7 (must be at a key level):
- Strength 3: Bullish/Bearish Engulfing, Three White Soldiers, Three Black Crows, Morning Star, Evening Star
- Strength 2: Hammer, Pin Bar, Shooting Star (only when at a confirmed S/R level)
- Strength 1: Doji, Inside Bar — these do NOT count as confluence

### Step 4 — Risk Management (non-negotiable)
- SL: Exactly 1.5×ATR beyond the structural invalidation level (the swing high/low that breaks the thesis)
- TP1: 55% of full TP2 distance (partial profit at first structural target)
- TP2: Next major structural level — MINIMUM 1:2.5 RR. If 1:2.5 is not achievable, output NO TRADE.
- Entry: At the key level only. If price is already > 0.3×ATR away from the entry level, output NO TRADE (entry missed).

## MANDATORY REJECTION — output NO TRADE if ANY of these apply:
- H4 trend opposes setup direction (unless extreme RSI exception above)
- Fewer than 4 independent H1 confluences
- Price in BB mid-range (20–80% BB position) with no candle pattern
- RSI between 38 and 62 (no momentum)
- MACD histogram flat or less than 20% of its recent average
- No active London or New York session
- ATR > 2.5× the instrument's normal ATR (excessive volatility)
- Spread > 0.07% of current price (slippage risk)
- Entry point > 0.3×ATR away from structural level (entry missed)
- Risk:Reward below 1:2.5 on TP2

## OUTPUT — valid JSON only, no markdown, no explanation outside the JSON:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <integer 0-100 — be brutally conservative: 85+ requires 5+ confluences perfectly aligned with H4; 90+ requires 6+ confluences AND candle confirmation AND London/NY session>,
  "entry": <number — exact entry price at the structural level>,
  "sl": <number — 1.5×ATR beyond the invalidation level>,
  "tp1": <number — 55% of full move, first partial target>,
  "tp2": <number — full structural target, minimum 1:2.5 RR from entry>,
  "rr": "<string — precise RR ratio e.g. '2.80'>",
  "confluences": ["H4 [trend] [RSI]", "H1 RSI [value]", "MACD crossover", "BB position", "S/R level [price]", "Session", "Candle pattern if any"],
  "reasoning": "<4 sentences: (1) H4 context and why it supports this direction, (2) specific H1 confluences that triggered the setup, (3) candle confirmation and exact level, (4) precise SL placement justification and TP2 structural target>"
}`

// ── User Prompt Builder ────────────────────────────────────────

function buildPrompt(r: AnalyzeRequest): string {
  const d = r.digits
  const bars = r.history.slice(-50)
  const high50 = Math.max(...bars.map(b => b.high))
  const low50  = Math.min(...bars.map(b => b.low))
  const spreadPct = ((r.spread / r.px) * 100).toFixed(3)

  const rsiLabel = r.rsi > 70 ? "OVERBOUGHT ⚠" : r.rsi > 60 ? "Elevated" : r.rsi < 30 ? "OVERSOLD ⚠" : r.rsi < 40 ? "Depressed" : "Neutral"
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

  return `=== INSTRUMENT ===
Symbol:        ${r.sym}
Current Price: ${r.px.toFixed(d)}
Spread:        ${r.spread} (${spreadPct}% of price)
Timeframe:     ${r.timeframe} | Strategy: ${r.skillset}

=== SESSIONS ===
Active: ${r.activeSessions.length > 0 ? r.activeSessions.join(", ") : "None (off-hours — low liquidity)"}

=== HIGHER TIMEFRAME — H4 BIAS (PRIMARY FILTER) ===
H4 Trend:      ${r.htf.trend} ← THIS DEFINES THE VALID TRADE DIRECTION
H4 RSI:        ${r.htf.rsi.toFixed(1)} → ${htfRsiLabel}
H4 Resistance: ${r.htf.resistance.length > 0 ? r.htf.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}
H4 Support:    ${r.htf.support.length > 0    ? r.htf.support.map(l => l.toFixed(d)).join(" | ")    : "None"}
H4 Last bar:   ${r.htf.lastBarBullish ? "Bullish close" : "Bearish close"} at ${r.htf.lastClose.toFixed(d)}

=== H1 TECHNICAL INDICATORS ===
RSI(14):       ${r.rsi.toFixed(1)} → ${rsiLabel}
MACD(12,26,9): Line ${r.macdLine.toFixed(d + 1)} | Signal ${r.signalLine.toFixed(d + 1)} | Hist ${r.histogram.toFixed(d + 1)} → ${macdDir}
BB(20,2):      Upper ${r.bb.upper.toFixed(d)} | Mid ${r.bb.mid.toFixed(d)} | Lower ${r.bb.lower.toFixed(d)} | Pos ${bbPos}% → ${bbLabel}
H1 Trend:      ${r.trend} (EMA20 vs EMA50)

=== KEY LEVELS (H1) ===
Resistance: ${r.resistance.length > 0 ? r.resistance.map(l => l.toFixed(d)).join(" | ") : "None"}
Support:    ${r.support.length > 0    ? r.support.map(l => l.toFixed(d)).join(" | ")    : "None"}
50-bar range: ${low50.toFixed(d)} — ${high50.toFixed(d)}

=== VOLATILITY ===
ATR(14):       ${r.atr.toFixed(d)} | Suggested SL distance: ${atrSL} (1.5×ATR)

=== CANDLE PATTERNS (last 5 bars) ===
${patternStr}

=== RECENT OHLCV (last 15 H1 bars) ===
${ohlcv}

=== TASK ===
1. Confirm H4 bias — ONLY trade in that direction. Contra-trend = NO TRADE.
2. Count H1 confluences strictly. Need ≥ 4 clear signals — do NOT stretch weak signals to reach the minimum.
3. Check session: London or New York must be active. If not, output NO TRADE.
4. Verify entry is within 0.3×ATR (${(r.atr * 0.3).toFixed(r.digits)}) of the structural level. If price has moved away, output NO TRADE.
5. Confirm TP2 achieves at least 1:2.5 RR. If not achievable, output NO TRADE.
6. If 4+ confluences align, place SL at 1.5×ATR (${atrSL}) beyond the invalidation level and output the signal.
7. When in doubt, output NO TRADE. A high-quality signal log matters more than signal frequency.`
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

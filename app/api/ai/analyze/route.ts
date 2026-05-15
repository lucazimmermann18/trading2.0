import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

interface OHLCV { time: number; open: number; high: number; low: number; close: number }

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
  // enriched context
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

const SYSTEM_PROMPT = `You are an elite institutional trading signal engine. You analyze multi-factor market data and generate ONLY high-probability trade signals.

## SIGNAL GENERATION RULES

### Required confluences (need ≥ 3 to generate a trade):
1. **Trend alignment** — EMA20 vs EMA50 direction matches trade bias
2. **RSI zone** — Oversold (<35) for BUY, Overbought (>65) for SELL
3. **MACD confirmation** — Crossover or momentum direction matches bias
4. **Bollinger Band level** — Price near/outside band in bias direction
5. **Key structural level** — Price at or very near support (BUY) or resistance (SELL)
6. **Session quality** — Active session (London, NY, or overlap) adds validity
7. **Liquidity sweep** — If price recently swept above resistance (then short) or below support (then long)

### Entry precision rules:
- Entry = current price OR first retrace level if overextended
- SL = beyond the most recent swing high/low (structural invalidation)
- TP1 = 50-60% of full move (partial profit)
- TP2 = full structural target (1:2+ minimum RR)
- Minimum R:R = 1:2.0 (reject setups below this)

### When to output "NO TRADE":
- Fewer than 3 confluences align
- Price in middle of range (no edge at either band or key level)
- Spread > 0.05% of price (execution risk)
- Trend is NEUTRAL with no strong indicator signal
- RSI between 40-60 with no momentum divergence
- Less than 2 active sessions (low liquidity)

## OUTPUT FORMAT
Respond ONLY with valid JSON — zero markdown, zero extra text:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <integer 0-100>,
  "entry": <precise entry price as number>,
  "sl": <stop loss as number — beyond structural invalidation>,
  "tp1": <first target as number — 50-60% of move>,
  "tp2": <final target as number — minimum 1:2 RR>,
  "rr": "<risk reward as string e.g. '2.40'>",
  "confluences": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "reasoning": "<3-4 sentence professional analysis: what level price is at, which confluences align, where invalidation is, why this is a high-probability setup>"
}`

// ── User Prompt Builder ────────────────────────────────────────

function buildPrompt(r: AnalyzeRequest): string {
  const d = r.digits
  const bars = r.history.slice(-50)
  const high50 = Math.max(...bars.map(b => b.high))
  const low50  = Math.min(...bars.map(b => b.low))
  const spreadPct = ((r.spread / r.px) * 100).toFixed(3)

  // RSI interpretation
  const rsiLabel = r.rsi > 70 ? "OVERBOUGHT ⚠️" : r.rsi > 60 ? "Elevated" : r.rsi < 30 ? "OVERSOLD ⚠️" : r.rsi < 40 ? "Depressed" : "Neutral"
  // MACD interpretation
  const macdLabel = r.macdLine > r.signalLine ? "BULLISH crossover" : "BEARISH crossover"
  const macdMomentum = r.histogram > 0 ? "strengthening" : "weakening"
  // BB position
  const bbWidth = r.bb.upper - r.bb.lower
  const bbPos = bbWidth > 0 ? ((r.px - r.bb.lower) / bbWidth * 100).toFixed(0) : "50"
  const bbLabel = Number(bbPos) < 20 ? "Near LOWER band (potential reversal up)" : Number(bbPos) > 80 ? "Near UPPER band (potential reversal down)" : "Mid-range"

  // Recent OHLCV (compact)
  const ohlcv = bars.slice(-20).map(b =>
    `${new Date(b.time * 1000).toISOString().slice(11, 16)} O:${b.open.toFixed(d)} H:${b.high.toFixed(d)} L:${b.low.toFixed(d)} C:${b.close.toFixed(d)}`
  ).join("\n")

  return `=== INSTRUMENT ===
Symbol: ${r.sym}
Current Price: ${r.px.toFixed(d)}
Spread: ${r.spread} (${spreadPct}% of price)
Timeframe: ${r.timeframe}
Strategy: ${r.skillset}

=== SESSION CONTEXT ===
Active Sessions: ${r.activeSessions.length > 0 ? r.activeSessions.join(", ") : "None (off-hours)"}

=== TECHNICAL INDICATORS ===
RSI(14):  ${r.rsi.toFixed(1)} → ${rsiLabel}
MACD(12,26,9):
  MACD Line:   ${r.macdLine.toFixed(d + 1)}
  Signal Line: ${r.signalLine.toFixed(d + 1)}
  Histogram:   ${r.histogram.toFixed(d + 1)} → ${macdLabel}, ${macdMomentum}
Bollinger Bands(20,2):
  Upper: ${r.bb.upper.toFixed(d)}
  Mid:   ${r.bb.mid.toFixed(d)}
  Lower: ${r.bb.lower.toFixed(d)}
  Position: ${bbPos}% → ${bbLabel}
Trend (EMA20 vs EMA50): ${r.trend}

=== KEY LEVELS ===
Resistance levels (nearest first): ${r.resistance.length > 0 ? r.resistance.map(l => l.toFixed(d)).join(" | ") : "None identified"}
Support levels   (nearest first): ${r.support.length > 0 ? r.support.map(l => l.toFixed(d)).join(" | ") : "None identified"}
50-bar high: ${high50.toFixed(d)}
50-bar low:  ${low50.toFixed(d)}

=== RECENT OHLCV (last 20 bars) ===
${ohlcv}

=== ANALYSIS REQUEST ===
Apply ${r.skillset} to find a high-probability setup in ${r.sym}.
Check all confluence factors. Return "NO TRADE" if fewer than 3 strong factors align.
Be precise with entry, SL (beyond structural invalidation), and targets.`
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

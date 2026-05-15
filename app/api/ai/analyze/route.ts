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

const SYSTEM_PROMPT = `You are a professional algorithmic trading signal engine used by institutional traders. Your job is to find ONLY the highest-probability setups — it is far better to output NO TRADE than to generate a low-quality signal.

## ANALYSIS FRAMEWORK

### Step 1 — Higher Timeframe Bias (H4) — NON-NEGOTIABLE
The H4 trend defines the ONLY valid trade direction.
- H4 UP → only BUY setups. Do NOT short unless H4 RSI > 72 AND price at major H4 resistance.
- H4 DOWN → only SELL setups. Do NOT buy unless H4 RSI < 28 AND price at major H4 support.
- H4 NEUTRAL → require 4+ additional confluences or output NO TRADE.

### Step 2 — Entry Timeframe Confluence (H1)
Need ≥ 3 of these aligned WITH the H4 bias:
1. RSI zone (< 35 oversold for BUY, > 65 overbought for SELL)
2. MACD crossover in signal direction
3. Bollinger Band extreme (price at/beyond lower band for BUY, upper band for SELL)
4. Price at key structural level (swing S/R, H4 level, or BB mid)
5. EMA20 > EMA50 for BUY / EMA20 < EMA50 for SELL
6. Session overlap (London+NY = highest quality, minimum 1 major session)

### Step 3 — Candle Pattern Confirmation (BONUS)
If a candle pattern confirms the bias at a key level, it adds strong conviction:
- Bullish Engulfing / Hammer / Pin Bar at support → strong BUY confirmation
- Bearish Engulfing / Shooting Star / Pin Bar at resistance → strong SELL confirmation
- Three White Soldiers / Three Black Crows → continuation momentum
- Evening Star / Morning Star → reversal with high reliability

### Step 4 — Risk Management
- SL: Place 1.5×ATR beyond the key structural level (NOT arbitrary)
- TP1: 50-60% of full move (partial profit lock)
- TP2: Next major structural level — minimum 1:2 RR required, prefer 1:2.5+
- Entry: Current price if at level, or wait for retrace if overextended (> 0.5×ATR from level)

## REJECTION CRITERIA — output NO TRADE if ANY of these apply:
- H4 trend contradicts setup direction (unless extreme RSI)
- Fewer than 3 H1 confluences
- Price in mid-range (BB position 30-70% with no pattern)
- RSI 42-58 range AND MACD flat (no momentum)
- Spread > 0.08% of price
- No active major trading session
- ATR unusually high (> 3× normal) = choppy, avoid

## OUTPUT — valid JSON only, no markdown:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <0-100 integer — be conservative: 90+ only if 5+ confluences align with H4>,
  "entry": <number — precise entry>,
  "sl": <number — 1.5×ATR beyond structural level>,
  "tp1": <number — 50-60% target>,
  "tp2": <number — full structural target, min 1:2 RR>,
  "rr": "<string e.g. '2.40'>",
  "confluences": ["<H4 bias>", "<H1 factor>", "<candle pattern if any>", "..."],
  "reasoning": "<4 sentences: H4 context, H1 setup trigger, candle confirmation if any, exact SL/TP levels and why>"
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
1. Check H4 bias — it determines the ONLY valid direction.
2. Count H1 confluences in that direction (need ≥ 3).
3. Check if any candle pattern confirms at a key level.
4. Place SL at 1.5×ATR (${atrSL}) beyond the invalidation level.
5. If setup quality is low, return NO TRADE — do not force a signal.`
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

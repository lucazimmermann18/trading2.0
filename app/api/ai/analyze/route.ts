import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

interface AnalyzeRequest {
  provider: "anthropic" | "openai" | "deepseek" | "gemini"
  model: string
  apiKey: string
  sym: string
  px: number
  digits: number
  rsi: number
  macd: number
  spread: number
  history: { time: number; open: number; high: number; low: number; close: number }[]
  skillset: string
}

interface SignalResult {
  side: "BUY" | "SELL" | "NO TRADE"
  confidence: number
  entry: number
  sl: number
  tp1: number
  tp2: number
  rr: string
  reasoning: string
}

const SYSTEM_PROMPT = `You are an elite institutional trading analyst specializing in forex, metals, crypto, and indices.
Analyze the provided market data and generate a precise trading signal.

Respond ONLY with a valid JSON object — no markdown, no explanation outside JSON:
{
  "side": "BUY" | "SELL" | "NO TRADE",
  "confidence": <integer 0-100>,
  "entry": <number>,
  "sl": <number>,
  "tp1": <number>,
  "tp2": <number>,
  "rr": "<string like '2.40'>",
  "reasoning": "<2-3 sentence institutional-grade analysis>"
}

Rules:
- If no clear edge exists, return "NO TRADE" with confidence < 50
- SL must be beyond a key level (structure, liquidity)
- TP2 should target a 1:2+ RR minimum
- Reasoning must reference specific price levels and confluence factors`

function buildUserPrompt(req: AnalyzeRequest): string {
  const bars = req.history.slice(-20)
  const recent = bars.map(b =>
    `T:${new Date(b.time * 1000).toISOString().slice(11, 16)} O:${b.open.toFixed(req.digits)} H:${b.high.toFixed(req.digits)} L:${b.low.toFixed(req.digits)} C:${b.close.toFixed(req.digits)}`
  ).join("\n")

  const high20 = Math.max(...bars.map(b => b.high))
  const low20  = Math.min(...bars.map(b => b.low))

  return `Pair: ${req.sym}
Current Price: ${req.px.toFixed(req.digits)}
Spread: ${req.spread}
RSI(14): ${req.rsi.toFixed(1)}
MACD: ${req.macd.toFixed(5)}
20-bar Range: High ${high20.toFixed(req.digits)} / Low ${low20.toFixed(req.digits)}
Strategy: ${req.skillset}

Recent OHLCV (last 20 bars, M1):
${recent}

Generate a trading signal for ${req.sym} using ${req.skillset} methodology.`
}

async function callAnthropic(req: AnalyzeRequest): Promise<SignalResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.content[0].text)
}

async function callOpenAI(req: AnalyzeRequest): Promise<SignalResult> {
  const isReasoning = req.model.startsWith("o")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model: req.model,
      ...(isReasoning ? {} : { temperature: 0.3 }),
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserPrompt(req) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

async function callDeepSeek(req: AnalyzeRequest): Promise<SignalResult> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model: req.model,
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserPrompt(req) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.choices[0].message.content
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : text)
}

async function callGemini(req: AnalyzeRequest): Promise<SignalResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${req.apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: buildUserPrompt(req) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.candidates[0].content.parts[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : text)
}

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

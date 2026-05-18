import { NextRequest, NextResponse } from "next/server"
import { dbGetAPIKey } from "@/app/lib/actions/apikeys"

interface OHLCV { time: number; open: number; high: number; low: number; close: number }

interface ReviewRequest {
  provider: "anthropic" | "openai" | "deepseek" | "gemini"
  model: string
  apiKey: string  // always injected server-side; client value is discarded
  sym: string
  digits: number
  side: "BUY" | "SELL"
  outcome: "TP2" | "TP1" | "SL" | "EXPIRED"
  pnl_r: number
  entry: number
  sl: number
  tp1: number
  tp2: number
  exitPrice: number
  signalTime: number
  reasoning: string        // original AI reasoning
  confluences: string[]    // original confluences
  recentBars: OHLCV[]     // bars around the trade
  regime: string
  session: string
}

interface ReviewResult {
  lesson: string
  strengths: string[]
  mistakes: string[]
  nextTime: string
}

const REVIEW_SYSTEM = `You are a professional trading coach reviewing completed trades for a Smart Money Concepts (SMC) trader. Your job is to give honest, specific, actionable feedback.

Be concise and brutally honest. Focus on PROCESS not outcome (a losing trade with good process is fine; a winning trade with bad process is not).

Output ONLY valid JSON:`

function buildReviewPrompt(r: ReviewRequest): string {
  const d = r.digits
  const outcome = r.outcome === "TP2" ? `TP2 HIT (+${r.pnl_r.toFixed(2)}R)` :
                  r.outcome === "TP1" ? `TP1 HIT (+${r.pnl_r.toFixed(2)}R, still partial)` :
                  r.outcome === "SL"  ? `STOP LOSS HIT (-1.00R)` :
                  `EXPIRED (0R)`

  const bars = r.recentBars.slice(-20).map(b =>
    `${new Date(b.time * 1000).toISOString().slice(11,16)} O:${b.open.toFixed(d)} H:${b.high.toFixed(d)} L:${b.low.toFixed(d)} C:${b.close.toFixed(d)}`
  ).join("\n")

  return `=== TRADE REVIEW ===

Symbol:   ${r.sym}
Side:     ${r.side}
Outcome:  ${outcome}
Regime:   ${r.regime}
Session:  ${r.session}

Entry:  ${r.entry.toFixed(d)}
SL:     ${r.sl.toFixed(d)} (${Math.abs(r.entry - r.sl).toFixed(d)} distance)
TP1:    ${r.tp1.toFixed(d)}
TP2:    ${r.tp2.toFixed(d)} (RR target)
Exit:   ${r.exitPrice.toFixed(d)}

Original AI reasoning:
${r.reasoning}

Confluences that were met:
${r.confluences.length ? r.confluences.map(c => `- ${c}`).join("\n") : "None listed"}

Price action during trade (last 20 bars from signal):
${bars}

=== YOUR TASK ===
Review this trade honestly. Output JSON:
{
  "lesson": "<1-2 sentence core lesson from this specific trade>",
  "strengths": ["<what was done well — be specific to this trade>"],
  "mistakes": ["<what went wrong or could be improved — be specific>"],
  "nextTime": "<one concrete thing to do differently next time on ${r.sym}>"
}`
}

async function callProvider(r: ReviewRequest): Promise<ReviewResult> {
  const prompt = buildReviewPrompt(r)

  if (r.provider === "anthropic") {
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
        max_tokens: 500,
        system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json()
    const text = data.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in review response")
    return JSON.parse(match[0]) as ReviewResult
  }

  // All other providers share the same chat format
  const url = r.provider === "openai"   ? "https://api.openai.com/v1/chat/completions"
            : r.provider === "deepseek" ? "https://api.deepseek.com/v1/chat/completions"
            : null

  if (url) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${r.apiKey}` },
      body: JSON.stringify({
        model: r.model,
        temperature: 0.3,
        max_completion_tokens: 500,
        messages: [
          { role: "system", content: REVIEW_SYSTEM },
          { role: "user",   content: prompt },
        ],
      }),
    })
    if (!res.ok) throw new Error(`${r.provider} ${res.status}`)
    const data = await res.json()
    const text = data.choices[0].message.content
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in review response")
    return JSON.parse(match[0]) as ReviewResult
  }

  if (r.provider === "gemini") {
    const gemUrl = `https://generativelanguage.googleapis.com/v1beta/models/${r.model}:generateContent?key=${r.apiKey}`
    const res = await fetch(gemUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: REVIEW_SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = await res.json()
    const text = data.candidates[0].content.parts[0].text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in review response")
    return JSON.parse(match[0]) as ReviewResult
  }

  throw new Error("Unknown provider")
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const keyRecord = await dbGetAPIKey(raw.provider)
    if (!keyRecord) return NextResponse.json({ error: "No API key configured" }, { status: 401 })
    const body: ReviewRequest = {
      ...raw,
      apiKey: keyRecord.apiKey,
      model: raw.model || keyRecord.model,
    }
    const result = await callProvider(body)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

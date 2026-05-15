import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

interface Signal {
  sym: string
  side: "BUY" | "SELL"
  entry: number
  sl: number
  tp1: number
  tp2: number
  confidence: number
  rr: string
  tf: string
  skillset: string
  why: string
  digits: number
}

interface NotifyRequest {
  signal: Signal
  channels: {
    telegram: boolean
    webhook: boolean
    discord: boolean
  }
  telegramToken?: string
  telegramChatId?: string
  webhookUrl?: string
  discordWebhookUrl?: string
}

function fmt(v: number, d: number): string {
  return v.toFixed(d)
}

function buildTelegramMessage(s: Signal): string {
  const side = s.side === "BUY" ? "🟢 BUY" : "🔴 SELL"
  const conf = s.confidence >= 70 ? "🔥" : s.confidence >= 50 ? "⚡" : "📊"
  return [
    `<b>⚡ TradeAI Pro — New Signal</b>`,
    ``,
    `<b>${s.sym}</b> · ${side}`,
    `📈 Strategy: <i>${s.skillset}</i> · ${s.tf}`,
    `${conf} Confidence: <b>${s.confidence}%</b> · R:R 1:${s.rr}`,
    ``,
    `<b>Entry:</b>  <code>${fmt(s.entry, s.digits)}</code>`,
    `<b>Stop:</b>   <code>${fmt(s.sl,    s.digits)}</code>`,
    `<b>TP1:</b>    <code>${fmt(s.tp1,   s.digits)}</code>`,
    `<b>TP2:</b>    <code>${fmt(s.tp2,   s.digits)}</code>`,
    ``,
    `<i>${s.why.slice(0, 280)}${s.why.length > 280 ? "…" : ""}</i>`,
    ``,
    `<code>TradeAI Pro · ${new Date().toUTCString()}</code>`,
  ].join("\n")
}

function buildDiscordEmbed(s: Signal) {
  const col = s.side === "BUY" ? 0x00ff88 : 0xff3d5a
  return {
    embeds: [{
      title: `⚡ ${s.sym} · ${s.side}`,
      color: col,
      description: `**${s.skillset}** · ${s.tf} · Confidence **${s.confidence}%**\n\n${s.why.slice(0, 400)}`,
      fields: [
        { name: "Entry",  value: `\`${fmt(s.entry, s.digits)}\``, inline: true },
        { name: "Stop",   value: `\`${fmt(s.sl,    s.digits)}\``, inline: true },
        { name: "TP1",    value: `\`${fmt(s.tp1,   s.digits)}\``, inline: true },
        { name: "TP2",    value: `\`${fmt(s.tp2,   s.digits)}\``, inline: true },
        { name: "R:R",    value: `1:${s.rr}`,                     inline: true },
      ],
      footer: { text: `TradeAI Pro · ${new Date().toUTCString()}` },
      timestamp: new Date().toISOString(),
    }],
  }
}

function buildWebhookPayload(s: Signal) {
  return {
    event: "signal",
    timestamp: new Date().toISOString(),
    symbol: s.sym,
    side: s.side,
    timeframe: s.tf,
    skillset: s.skillset,
    confidence: s.confidence,
    rr: s.rr,
    entry: s.entry,
    sl: s.sl,
    tp1: s.tp1,
    tp2: s.tp2,
    reasoning: s.why,
  }
}

export async function POST(req: NextRequest) {
  const body: NotifyRequest = await req.json()
  const { signal, channels, telegramToken, telegramChatId, webhookUrl, discordWebhookUrl } = body

  const results: Record<string, string> = {}

  if (channels.telegram && telegramToken && telegramChatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: buildTelegramMessage(signal),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      })
      results.telegram = res.ok ? "ok" : `error ${res.status}`
    } catch (e) {
      results.telegram = `error: ${e instanceof Error ? e.message : "unknown"}`
    }
  }

  if (channels.webhook && webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWebhookPayload(signal)),
      })
      results.webhook = res.ok ? "ok" : `error ${res.status}`
    } catch (e) {
      results.webhook = `error: ${e instanceof Error ? e.message : "unknown"}`
    }
  }

  if (channels.discord && discordWebhookUrl) {
    try {
      const res = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiscordEmbed(signal)),
      })
      results.discord = res.ok ? "ok" : `error ${res.status}`
    } catch (e) {
      results.discord = `error: ${e instanceof Error ? e.message : "unknown"}`
    }
  }

  return NextResponse.json({ results })
}

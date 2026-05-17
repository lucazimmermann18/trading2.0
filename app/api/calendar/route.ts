import { NextResponse } from "next/server"

export const runtime = "edge"

// Server-side in-memory cache (survives warm lambda, but not cold starts)
let serverCache: { data: unknown; at: number } | null = null
const SERVER_CACHE_MS = 4 * 60 * 60 * 1000 // 4h

export async function GET() {
  if (serverCache && Date.now() - serverCache.at < SERVER_CACHE_MS) {
    return NextResponse.json(serverCache.data)
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return NextResponse.json([])

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(today.getUTCDate() + 1)
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

  try {
    const url = `https://api.twelvedata.com/economic_calendar?start_date=${fmtDate(today)}&end_date=${fmtDate(tomorrow)}&importance=high&format=JSON&apikey=${apiKey}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    const events = Array.isArray(data.result) ? data.result : []
    serverCache = { data: events, at: Date.now() }
    return NextResponse.json(events)
  } catch {
    return NextResponse.json([])
  }
}

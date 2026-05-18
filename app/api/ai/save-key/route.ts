import { NextRequest, NextResponse } from "next/server"
import { dbSaveAPIKey } from "@/app/lib/actions/apikeys"

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, model } = await request.json()
    if (!provider || !apiKey || !model) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    await dbSaveAPIKey(provider, apiKey.trim(), model)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

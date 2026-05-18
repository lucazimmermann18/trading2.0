import { NextResponse } from "next/server"
import { dbGetAPIKeyStatus } from "@/app/lib/actions/apikeys"

export async function GET() {
  try {
    const status = await dbGetAPIKeyStatus()
    return NextResponse.json(status)
  } catch {
    return NextResponse.json({})
  }
}

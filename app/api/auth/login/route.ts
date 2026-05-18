import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "CHANGE_ME_32_CHARS_MINIMUM_SECRET!"
)

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Server not configured — set ADMIN_PASSWORD" }, { status: 500 })
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      // Artificial delay to prevent brute-force
      await new Promise(r => setTimeout(r, 800))
      return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 })
    }

    const token = await new SignJWT({ isLoggedIn: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(SECRET)

    const res = NextResponse.json({ ok: true })
    res.cookies.set("trading_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })
    return res
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push("/")
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? "Login fehlgeschlagen")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[340px] animate-riseIn">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#00d4ff" strokeWidth="1.5">
              <path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>
            </svg>
          </div>
          <div className="text-[22px] font-semibold text-white tracking-tight">TradeAI</div>
          <div className="text-[11.5px] text-mute mt-1">Smart Money Concepts · AI-Powered</div>
        </div>

        {/* Card */}
        <div className="bg-ink-900 border border-white/[0.06] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.18em] uppercase text-mute mb-2">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoFocus
                className="w-full h-10 px-3 rounded-md bg-white/[0.025] border border-white/[0.06] text-[13px] text-white outline-none focus:border-accent-blue/50 placeholder:text-mute/40 transition"
              />
            </div>

            {error && (
              <div className="text-[11px] text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-10 rounded-md bg-accent-blue text-ink-950 text-[13px] font-semibold hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {loading ? "Wird geprüft…" : "Anmelden"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-[10px] text-mute/50">
          Session läuft 30 Tage — danach erneut einloggen
        </div>
      </div>
    </div>
  )
}

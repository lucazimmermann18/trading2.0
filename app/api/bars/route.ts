export const runtime = "edge"

const TD_SYMBOL_MAP: Record<string, string> = {
  "US100":  "NDX",
  "US30":   "DJI",
  "WTI":    "WTI/USD",
  "US500":  "SPX",
  "GER40":  "DAX",
  "NATGAS": "NATGAS/USD",
}

const TF_MAP: Record<string, string> = {
  M1: "1min", M5: "5min", M15: "15min", H1: "1h", H4: "4h", D1: "1day",
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const sym  = searchParams.get("sym")  ?? ""
  const tf   = searchParams.get("tf")   ?? "H1"
  const size = searchParams.get("size") ?? "150"

  const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" }

  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY
    if (!apiKey) throw new Error("Missing TWELVE_DATA_API_KEY")

    const symbol   = TD_SYMBOL_MAP[sym] ?? sym
    const interval = TF_MAP[tf] ?? tf

    const url = new URL("https://api.twelvedata.com/time_series")
    url.searchParams.set("symbol",     symbol)
    url.searchParams.set("interval",   interval)
    url.searchParams.set("outputsize", size)
    url.searchParams.set("apikey",     apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`)

    type TDResp = {
      status?: string
      message?: string
      values?: {
        datetime: string
        open: string
        high: string
        low: string
        close: string
        volume?: string
      }[]
    }

    const data = await res.json() as TDResp
    if (data.status === "error") throw new Error(data.message ?? "API error")
    if (!data.values?.length) return new Response("[]", { headers })

    const bars = data.values.reverse().map(v => ({
      // Force UTC parsing: TwelveData returns "YYYY-MM-DD HH:MM:SS" without timezone
      time:   Math.floor(new Date(v.datetime.replace(" ", "T") + "Z").getTime() / 1000),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseFloat(v.volume ?? "0"),
    })).filter(b => Number.isFinite(b.time) && b.time > 0)

    return new Response(JSON.stringify(bars), { headers })
  } catch {
    return new Response("[]", { headers })
  }
}

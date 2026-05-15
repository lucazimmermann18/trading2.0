"use client"
import { useEffect, useRef, useState, useCallback } from "react"

const WS_URL = "wss://ws.twelvedata.com/v1/quotes/price"
const API_KEY = process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY ?? ""

const SYM_MAP: Record<string, string> = {
  "US100":  "NDX",
  "US30":   "DJI",
  "WTI":    "WTI/USD",
  "US500":  "SPX",
  "GER40":  "DAX",
  "NATGAS": "NATGAS/USD",
}
// Reverse map: WS symbol → app symbol
const REV_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SYM_MAP).map(([k, v]) => [v, k])
)

function toWSSym(appSym: string): string {
  return SYM_MAP[appSym] ?? appSym
}
function toAppSym(wsSym: string): string {
  return REV_MAP[wsSym] ?? wsSym
}

interface UseTwelveDataWSOptions {
  symbols: string[]
  enabled: boolean
  onPrice: (sym: string, price: number) => void
}

export function useTwelveDataWS({ symbols, enabled, onPrice }: UseTwelveDataWSOptions) {
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const onPriceRef = useRef(onPrice)
  const symbolsRef = useRef(symbols)

  // Keep refs up to date without reconnecting
  useEffect(() => { onPriceRef.current = onPrice }, [onPrice])
  useEffect(() => { symbolsRef.current = symbols }, [symbols])

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
    if (pingTimerRef.current)  { clearInterval(pingTimerRef.current);  pingTimerRef.current = null  }
  }, [])

  const subscribe = useCallback((ws: WebSocket, syms: string[]) => {
    if (ws.readyState !== WebSocket.OPEN || !syms.length) return
    const mapped = syms.map(toWSSym).join(",")
    ws.send(JSON.stringify({ action: "subscribe", params: { symbols: mapped } }))
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.close()
      wsRef.current = null
    }
    clearTimers()

    const ws = new WebSocket(`${WS_URL}?apikey=${API_KEY}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      retryCountRef.current = 0
      subscribe(ws, symbolsRef.current)
      // Ping every 30s to keep connection alive
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "heartbeat" }))
        }
      }, 30000)
    }

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(evt.data as string)
        if (msg.event === "price" && typeof msg.price === "number" && msg.symbol) {
          const appSym = toAppSym(msg.symbol as string)
          onPriceRef.current(appSym, msg.price as number)
          setLastUpdate(Date.now())
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setConnected(false)
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      clearTimers()
      // Exponential backoff: 2s, 4s, 8s, then give up
      if (retryCountRef.current < 3 && enabled) {
        const delay = Math.pow(2, retryCountRef.current + 1) * 1000
        retryCountRef.current++
        retryTimerRef.current = setTimeout(connect, delay)
      }
    }
  }, [enabled, subscribe, clearTimers])

  // Connect/disconnect when enabled changes or symbols change significantly
  useEffect(() => {
    if (!enabled) {
      clearTimers()
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
      retryCountRef.current = 0
      return
    }
    connect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Re-subscribe when symbols list changes (without reconnecting)
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && enabled) {
      subscribe(wsRef.current, symbols)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(","), enabled])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { connected, lastUpdate }
}

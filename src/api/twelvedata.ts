import type { OHLCV, Quote, TimeFrame } from '../types'

const API_KEY = '36d7c96edf3c44a4a50a69a03dde49cc'
const BASE_URL = 'https://api.twelvedata.com'

async function fetchTD(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set('apikey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if ((data as { status?: string }).status === 'error') {
    throw new Error((data as { message?: string }).message || 'API Error')
  }
  return data
}

export async function fetchTimeSeries(symbol: string, interval: TimeFrame, outputsize = 120): Promise<OHLCV[]> {
  const data = await fetchTD('time_series', {
    symbol,
    interval,
    outputsize: String(outputsize),
    format: 'JSON',
  }) as { values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }> }

  if (!data.values) return []

  return data.values
    .reverse()
    .map((v) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || '0'),
    }))
}

export async function fetchQuote(symbols: string[]): Promise<Quote[]> {
  const symbolStr = symbols.join(',')
  const data = await fetchTD('quote', { symbol: symbolStr }) as Record<string, {
    symbol: string
    name: string
    close: string
    change: string
    percent_change: string
    fifty_two_week?: { high: string; low: string }
    volume: string
    exchange: string
    type: string
    high: string
    low: string
  }>

  const normalize = (item: {
    symbol: string
    name: string
    close: string
    change: string
    percent_change: string
    fifty_two_week?: { high: string; low: string }
    volume: string
    exchange: string
    type: string
    high: string
    low: string
  }): Quote => ({
    symbol: item.symbol,
    name: item.name,
    price: parseFloat(item.close),
    change: parseFloat(item.change),
    changePercent: parseFloat(item.percent_change),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    volume: parseFloat(item.volume || '0'),
    exchange: item.exchange,
    type: (item.type?.toLowerCase() === 'digital currency' ? 'crypto' : 'stock') as Quote['type'],
  })

  if (symbols.length === 1) {
    const item = data as unknown as Parameters<typeof normalize>[0]
    return [normalize(item)]
  }

  return symbols.map((s) => normalize(data[s])).filter(Boolean)
}

export async function fetchRSI(symbol: string, interval: TimeFrame): Promise<{ value: number; datetime: string }[]> {
  const data = await fetchTD('rsi', { symbol, interval, time_period: '14', series_type: 'close' }) as {
    values?: Array<{ datetime: string; rsi: string }>
  }
  if (!data.values) return []
  return data.values.slice(0, 20).reverse().map((v) => ({ value: parseFloat(v.rsi), datetime: v.datetime }))
}

export async function fetchMACD(symbol: string, interval: TimeFrame): Promise<{ macd: number; signal: number; histogram: number; datetime: string }[]> {
  const data = await fetchTD('macd', { symbol, interval, series_type: 'close' }) as {
    values?: Array<{ datetime: string; macd: string; macd_signal: string; macd_hist: string }>
  }
  if (!data.values) return []
  return data.values.slice(0, 20).reverse().map((v) => ({
    macd: parseFloat(v.macd),
    signal: parseFloat(v.macd_signal),
    histogram: parseFloat(v.macd_hist),
    datetime: v.datetime,
  }))
}

export async function fetchEMA(symbol: string, interval: TimeFrame, period: number): Promise<{ value: number; datetime: string }[]> {
  const data = await fetchTD('ema', { symbol, interval, time_period: String(period), series_type: 'close' }) as {
    values?: Array<{ datetime: string; ema: string }>
  }
  if (!data.values) return []
  return data.values.slice(0, 100).reverse().map((v) => ({ value: parseFloat(v.ema), datetime: v.datetime }))
}

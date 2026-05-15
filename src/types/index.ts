export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  marketCap?: number
  exchange: string
  type: 'stock' | 'crypto' | 'forex' | 'etf'
}

export interface Signal {
  id: string
  symbol: string
  type: 'BUY' | 'SELL' | 'HOLD'
  price: number
  targetPrice: number
  stopLoss: number
  confidence: number
  indicator: string
  timestamp: number
  timeframe: string
}

export interface TechnicalIndicator {
  name: string
  value: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
}

export type TimeFrame = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week'

export type NavTab = 'dashboard' | 'charts' | 'signals' | 'watchlist' | 'portfolio'

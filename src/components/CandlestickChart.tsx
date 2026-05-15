import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  type HistogramSeriesOptions,
} from 'lightweight-charts'
import { fetchTimeSeries, fetchEMA } from '../api/twelvedata'
import type { TimeFrame } from '../types'

interface Props {
  symbol: string
  interval: TimeFrame
  showEMA: boolean
  chartType: 'candle' | 'line'
}

export default function CandlestickChart({ symbol, interval, showEMA, chartType }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#12181f' },
        textColor: '#8899aa',
      },
      grid: {
        vertLines: { color: '#1e2a3a' },
        horzLines: { color: '#1e2a3a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#2a3f55', width: 1, style: 3 },
        horzLine: { color: '#2a3f55', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: '#1e2a3a',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: '#1e2a3a',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3d5a',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff3d5a',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3d5a',
    } as Partial<CandlestickSeriesOptions>)
    candleSeriesRef.current = candleSeries

    const lineSeries = chart.addLineSeries({
      color: '#00d4ff',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#00d4ff',
      crosshairMarkerBackgroundColor: '#070a12',
    })
    lineSeriesRef.current = lineSeries

    const volSeries = chart.addHistogramSeries({
      color: '#1d2531',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    } as Partial<HistogramSeriesOptions>)
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })
    volumeSeriesRef.current = volSeries

    const ema20 = chart.addLineSeries({
      color: '#ffb800',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    ema20Ref.current = ema20

    const ema50 = chart.addLineSeries({
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    ema50Ref.current = ema50

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [candles, ema20data, ema50data] = await Promise.all([
          fetchTimeSeries(symbol, interval, 200),
          showEMA ? fetchEMA(symbol, interval, 20) : Promise.resolve([]),
          showEMA ? fetchEMA(symbol, interval, 50) : Promise.resolve([]),
        ])

        if (candles.length === 0) {
          setError('No data available for this symbol/timeframe')
          setLoading(false)
          return
        }

        const candleData = candles.map((c) => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))

        const lineData = candles.map((c) => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          value: c.close,
        }))

        const volumeData = candles.map((c) => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(0,255,136,0.25)' : 'rgba(255,61,90,0.25)',
        }))

        if (chartType === 'candle') {
          candleSeriesRef.current?.setData(candleData)
          candleSeriesRef.current?.applyOptions({ visible: true })
          lineSeriesRef.current?.applyOptions({ visible: false })
        } else {
          lineSeriesRef.current?.setData(lineData)
          lineSeriesRef.current?.applyOptions({ visible: true })
          candleSeriesRef.current?.applyOptions({ visible: false })
        }

        volumeSeriesRef.current?.setData(volumeData)

        if (showEMA && ema20data.length > 0) {
          const e20 = ema20data.map((d) => ({
            time: Math.floor(new Date(d.datetime).getTime() / 1000) as unknown as import('lightweight-charts').Time,
            value: d.value,
          }))
          ema20Ref.current?.setData(e20)
          ema20Ref.current?.applyOptions({ visible: true })
        } else {
          ema20Ref.current?.applyOptions({ visible: false })
        }

        if (showEMA && ema50data.length > 0) {
          const e50 = ema50data.map((d) => ({
            time: Math.floor(new Date(d.datetime).getTime() / 1000) as unknown as import('lightweight-charts').Time,
            value: d.value,
          }))
          ema50Ref.current?.setData(e50)
          ema50Ref.current?.applyOptions({ visible: true })
        } else {
          ema50Ref.current?.applyOptions({ visible: false })
        }

        chartRef.current?.timeScale().fitContent()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chart load failed')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [symbol, interval, showEMA, chartType])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {loading && (
        <div className="chart-loading">
          <div className="spinner" />
        </div>
      )}

      {error && !loading && (
        <div className="chart-loading" style={{ background: 'transparent' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        </div>
      )}

      {showEMA && !loading && !error && (
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
          <span style={{ fontSize: 11, color: '#ffb800', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 18, height: 2, background: '#ffb800', display: 'inline-block' }} />
            EMA 20
          </span>
          <span style={{ fontSize: 11, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 18, height: 2, background: '#a78bfa', display: 'inline-block' }} />
            EMA 50
          </span>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import {
  applyLiveMarketCandleUpdate,
  formatMarketCandleForPair,
  getHistoricalMarketCandles,
  isMarketDataStale,
  mergeMarketCandles,
  type MarketCandle,
  type MarketCandleInterval,
  type MarketCandleUpdate,
  type MarketPair,
} from '../services/marketCandleService'
import type { MarketConnectionStatus } from '../services/marketTickerService'
import './MarketChart.css'

type MarketChartProps = {
  pair: MarketPair
  interval: MarketCandleInterval
  liveUpdate: (MarketCandleUpdate & { receivedAt: number }) | null
  connectionStatus: MarketConnectionStatus
  theme: 'dark' | 'light'
}

type HistoryState = {
  key: string
  retry: number
  status: 'loading' | 'ready' | 'empty' | 'error'
  error: string
}

type ChartDataState = {
  key: string
  candles: MarketCandle[]
  lastUpdateAt: number | null
}

function chartColors(theme: 'dark' | 'light') {
  return theme === 'dark'
    ? { background: '#121917', text: '#a7b2ab', grid: '#202a24', border: '#29342d', up: '#6fc693', down: '#ed7772' }
    : { background: '#ffffff', text: '#5e6b63', grid: '#e6ece7', border: '#d8e0d9', up: '#21834e', down: '#c84f4a' }
}

function toChartData(candle: MarketCandle) {
  return {
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 }).format(price)
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .format(timestamp)
}

export default function MarketChart({
  pair,
  interval,
  liveUpdate,
  connectionStatus,
  theme,
}: MarketChartProps) {
  const key = `${pair}:${interval}`
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const chartKeyRef = useRef('')
  const chartDataRef = useRef<ChartDataState>({ key: '', candles: [], lastUpdateAt: null })

  const [chartState, setChartState] = useState<ChartDataState>({ key: '', candles: [], lastUpdateAt: null })
  const [history, setHistory] = useState<HistoryState>({ key: '', retry: -1, status: 'loading', error: '' })
  const [now, setNow] = useState(() => Date.now())
  const [feedStartedAt] = useState(() => Date.now())
  const [retry, setRetry] = useState(0)
  const activeHistory = history.key === key && history.retry === retry
    ? history
    : { key, retry, status: 'loading' as const, error: '' }
  const activeChartData = chartState.key === key ? chartState : { key, candles: [], lastUpdateAt: null }
  const candles = activeChartData.candles
  const lastUpdateAt = activeChartData.lastUpdateAt
  const latestCandle = candles.at(-1)
  const isStale = isMarketDataStale(lastUpdateAt, feedStartedAt, now)

  const replaceChartData = (next: ChartDataState) => {
    chartDataRef.current = next
    setChartState(next)
  }

  useEffect(() => {
    const colors = chartColors('dark')
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: colors.border }, horzLine: { color: colors.border } },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: false,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
      priceLineVisible: true,
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
    })
    chartRef.current = chart
    seriesRef.current = series

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({
        width: Math.max(Math.floor(entry.contentRect.width), 1),
        height: Math.max(Math.floor(entry.contentRect.height), 1),
      })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const colors = chartColors(theme)
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
      crosshair: { vertLine: { color: colors.border }, horzLine: { color: colors.border } },
    })
    seriesRef.current?.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    })
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    if (chartKeyRef.current !== key) {
      chartKeyRef.current = key
      seriesRef.current?.setData([])
    }

    void getHistoricalMarketCandles(pair, interval, controller.signal).then((historicalCandles) => {
      if (controller.signal.aborted) return
      const previous = chartDataRef.current.key === key ? chartDataRef.current : { key, candles: [], lastUpdateAt: null }
      const merged = mergeMarketCandles(historicalCandles, previous.candles)
      const next = { key, candles: merged, lastUpdateAt: previous.lastUpdateAt }
      replaceChartData(next)
      setHistory({
        key,
        retry,
        status: historicalCandles.length > 0 ? 'ready' : 'empty',
        error: '',
      })
      seriesRef.current?.setData(merged.map(toChartData))
      if (merged.length > 1) chartRef.current?.timeScale().scrollToRealTime()
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setHistory({
        key,
        retry,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load Binance candle history.',
      })
    })

    return () => controller.abort()
  }, [interval, key, pair, retry])

  useEffect(() => {
    if (!liveUpdate || liveUpdate.interval !== interval) return
    const candle = formatMarketCandleForPair(liveUpdate.candle, pair)
    const previous = chartDataRef.current.key === key ? chartDataRef.current : { key, candles: [], lastUpdateAt: null }
    const next = applyLiveMarketCandleUpdate(
      previous.candles,
      candle,
      liveUpdate.receivedAt,
    )

    replaceChartData({
      key,
      candles: next.candles,
      lastUpdateAt: next.lastReceivedAt,
    })
    if (next.candles !== previous.candles && seriesRef.current) {
      seriesRef.current.update(toChartData(candle))
    }
  }, [interval, key, liveUpdate, pair])

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    const timer = window.setInterval(updateNow, 2_000)
    document.addEventListener('visibilitychange', updateNow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [])

  const feedLabel = connectionStatus === 'disconnected'
    ? 'DISCONNECTED'
    : isStale
      ? 'STALE DATA'
      : connectionStatus === 'reconnecting'
      ? 'RECONNECTING'
      : connectionStatus === 'connecting'
        ? 'CONNECTING'
        : lastUpdateAt === null
          ? 'WAITING FOR LIVE CANDLE'
          : 'LIVE'
  const feedTone = feedLabel === 'LIVE' ? 'live' : feedLabel === 'STALE DATA' || feedLabel === 'RECONNECTING' ? 'stale' : 'offline'
  const showHistoryState = candles.length === 0
    || activeHistory.status === 'error'
    || (candles.length === 1 && activeHistory.status === 'loading')
    || (candles.length === 1 && activeHistory.status === 'empty')

  return (
    <div className="market-chart">
      <div className="market-chart-heading">
        <div>
          <strong>{pair}</strong>
          <span>Binance Spot · {interval} candles</span>
        </div>
        <div className="market-chart-price">
          <span>{lastUpdateAt === null ? 'HISTORICAL CLOSE' : feedLabel === 'LIVE' ? 'LIVE BINANCE PRICE' : 'LAST BINANCE UPDATE'}</span>
          <strong>{latestCandle ? `${formatPrice(latestCandle.close)} ${pair.split('/')[1]}` : '—'}</strong>
        </div>
      </div>
      <div
        className="market-chart-canvas"
        ref={containerRef}
        role="img"
        aria-label={`${pair} Binance spot candlestick chart, ${interval} interval`}
      />
      {showHistoryState && (
        <div className="market-chart-state" role={activeHistory.status === 'error' ? 'alert' : 'status'}>
          {activeHistory.status === 'loading'
            ? <><strong>Loading Binance candle history</strong><span>Fetching verified {interval} OHLC data for {pair}…</span></>
            : activeHistory.status === 'error'
              ? <><strong>Historical candles unavailable</strong><span>{activeHistory.error}</span><button type="button" onClick={() => setRetry((count) => count + 1)}>Retry chart data</button></>
              : activeHistory.status === 'empty'
                ? <><strong>No historical candles returned</strong><span>{connectionStatus === 'disconnected' ? 'Binance live stream is disconnected.' : 'Waiting for the Binance live kline stream.'}</span></>
                : <><strong>Binance market data unavailable</strong><span>{connectionStatus === 'disconnected' ? 'The live stream is disconnected.' : 'Waiting for a valid candle update.'}</span></>}
        </div>
      )}
      {activeHistory.status === 'error' && candles.length > 0 && (
        <p className="market-chart-warning" role="status">History refresh failed: {activeHistory.error}. Existing verified candles remain visible.</p>
      )}
      <div className="market-chart-footer">
        <span className={`market-chart-feed ${feedTone}`}><i />{feedLabel}{lastUpdateAt !== null && ` · ${formatTime(lastUpdateAt)}`}</span>
        <span>Binance market data · not DexSYS execution prices</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts by TradingView</a>
      </div>
    </div>
  )
}

import {
  MARKET_CANDLE_INTERVALS,
  parseMarketKlineMessage,
  type MarketCandleInterval,
  type MarketCandleUpdate,
} from './marketCandleService'

export const MARKET_TICKER_MAX_RETRIES = 8
export const MARKET_TICKER_BASE_RETRY_MS = 1_000
export const MARKET_TICKER_MAX_RETRY_MS = 30_000

export type MarketConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'disconnected'
export type MarketConnectionEvent = 'ticker' | 'connection-failed' | 'retry-exhausted' | 'manual-retry'

export type MarketTicker = {
  symbol: 'ETHBTC'
  price: number
}

type TickerUpdate = MarketTicker & { receivedAt: number }
type CandleUpdate = MarketCandleUpdate & { receivedAt: number }
type ConnectionCallbacks = {
  onStatus: (status: MarketConnectionStatus) => void
  onTicker: (ticker: TickerUpdate) => void
  onCandle?: (update: CandleUpdate) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseMarketTickerMessage(message: unknown): MarketTicker {
  if (typeof message !== 'string') throw new Error('Binance ticker message must be text.')

  let payload: unknown
  try {
    payload = JSON.parse(message)
  } catch {
    throw new Error('Binance ticker message is not valid JSON.')
  }
  if (!isRecord(payload) || payload.e !== '24hrTicker' || payload.s !== 'ETHBTC') {
    throw new Error('Binance returned an unexpected ticker message.')
  }
  if (typeof payload.c !== 'string' || payload.c.trim() === '') {
    throw new Error('Binance ticker message is missing its last price.')
  }

  const price = Number(payload.c)
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Binance ticker message contains an invalid last price.')
  }

  return { symbol: 'ETHBTC', price }
}

export function transitionMarketConnectionStatus(
  current: MarketConnectionStatus,
  event: MarketConnectionEvent,
): MarketConnectionStatus {
  switch (event) {
    case 'ticker':
      return 'live'
    case 'connection-failed':
      return current === 'disconnected' ? 'disconnected' : 'reconnecting'
    case 'retry-exhausted':
      return 'disconnected'
    case 'manual-retry':
      return 'connecting'
  }
}

export function getMarketTickerRetryDelay(retry: number): number {
  const exponent = Math.max(0, retry - 1)
  return Math.min(MARKET_TICKER_BASE_RETRY_MS * 2 ** exponent, MARKET_TICKER_MAX_RETRY_MS)
}

export function getMarketCombinedStreamUrl(interval: MarketCandleInterval): string {
  if (!MARKET_CANDLE_INTERVALS.includes(interval)) {
    throw new Error(`Binance kline interval ${interval} is not supported.`)
  }
  return `wss://stream.binance.com:9443/stream?streams=ethbtc@ticker/ethbtc@kline_${interval}`
}

export function subscribeToMarketTicker(
  callbacks: ConnectionCallbacks,
  interval: MarketCandleInterval = '1m',
): () => void {
  let active = true
  let status: MarketConnectionStatus = 'connecting'
  let retries = 0
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const setStatus = (event: MarketConnectionEvent) => {
    status = transitionMarketConnectionStatus(status, event)
    callbacks.onStatus(status)
  }

  const detachAndClose = (connection: WebSocket) => {
    connection.onopen = null
    connection.onmessage = null
    connection.onerror = null
    connection.onclose = null
    if (connection.readyState < WebSocket.CLOSING) connection.close()
  }

  const scheduleReconnect = () => {
    if (!active) return
    if (retries >= MARKET_TICKER_MAX_RETRIES) {
      setStatus('retry-exhausted')
      return
    }
    retries += 1
    setStatus('connection-failed')
    retryTimer = setTimeout(connect, getMarketTickerRetryDelay(retries))
  }

  const connect = () => {
    if (!active || socket) return

    let connection: WebSocket
    try {
      connection = new WebSocket(getMarketCombinedStreamUrl(interval))
    } catch {
      scheduleReconnect()
      return
    }
    socket = connection
    connection.onmessage = (event) => {
      if (!active || socket !== connection) return
      try {
        const payload: unknown = JSON.parse(event.data)
        const message = isRecord(payload) && 'data' in payload ? payload.data : payload
        if (isRecord(message) && message.e === 'kline') {
          const update = parseMarketKlineMessage(event.data, interval)
          retries = 0
          setStatus('ticker')
          callbacks.onCandle?.({ ...update, receivedAt: Date.now() })
        } else {
          const ticker = parseMarketTickerMessage(JSON.stringify(message))
          retries = 0
          setStatus('ticker')
          callbacks.onTicker({ ...ticker, receivedAt: Date.now() })
        }
      } catch {
        // Ignore malformed or unrelated frames; the stream remains active.
      }
    }
    connection.onerror = () => {
      if (socket === connection && connection.readyState < WebSocket.CLOSING) connection.close()
    }
    connection.onclose = () => {
      if (socket !== connection) return
      socket = null
      detachAndClose(connection)
      scheduleReconnect()
    }
  }

  callbacks.onStatus(status)
  connect()

  return () => {
    active = false
    if (retryTimer !== undefined) clearTimeout(retryTimer)
    retryTimer = undefined
    if (socket) {
      const connection = socket
      socket = null
      detachAndClose(connection)
    }
  }
}

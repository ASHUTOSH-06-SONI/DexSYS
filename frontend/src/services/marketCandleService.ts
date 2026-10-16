export const MARKET_CANDLE_INTERVALS = ['1m', '5m', '15m'] as const
export const MARKET_CANDLE_STALE_MS = 15_000

export type MarketCandleInterval = (typeof MARKET_CANDLE_INTERVALS)[number]
export type MarketPair = 'ETH/BTC' | 'BTC/ETH'
export type MarketCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  isFinal: boolean
}
export type MarketCandleUpdate = {
  symbol: 'ETHBTC'
  interval: MarketCandleInterval
  candle: MarketCandle
}

export function isMarketPair(pair: string): pair is MarketPair {
  return pair === 'ETH/BTC' || pair === 'BTC/ETH'
}

export function isMarketDataStale(
  lastReceivedAt: number | null,
  feedStartedAt: number,
  now: number,
): boolean {
  return now - (lastReceivedAt ?? feedStartedAt) > MARKET_CANDLE_STALE_MS
}

const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'
const BINANCE_SYMBOL = 'ETHBTC'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNumericString(value: unknown, label: string): number {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Binance candle is missing ${label}.`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Binance candle has an invalid ${label}.`)
  return parsed
}

function timeframeSeconds(interval: MarketCandleInterval): number {
  return Number.parseInt(interval, 10) * 60
}

function normalizeCandle(
  timeMs: unknown,
  openValue: unknown,
  highValue: unknown,
  lowValue: unknown,
  closeValue: unknown,
  volumeValue: unknown,
  quoteVolumeValue: unknown,
  interval: MarketCandleInterval,
  isFinal: boolean,
): MarketCandle {
  if (typeof timeMs !== 'number' || !Number.isSafeInteger(timeMs) || timeMs < 0 || timeMs % 1_000 !== 0) {
    throw new Error('Binance candle has an invalid open timestamp.')
  }
  const time = timeMs / 1_000
  if (time % timeframeSeconds(interval) !== 0) {
    throw new Error(`Binance candle timestamp is not aligned to ${interval}.`)
  }

  const open = parseNumericString(openValue, 'open price')
  const high = parseNumericString(highValue, 'high price')
  const low = parseNumericString(lowValue, 'low price')
  const close = parseNumericString(closeValue, 'close price')
  const volume = parseNumericString(volumeValue, 'base volume')
  const quoteVolume = parseNumericString(quoteVolumeValue, 'quote volume')
  if (
    open <= 0 || high <= 0 || low <= 0 || close <= 0
    || high < Math.max(open, close) || low > Math.min(open, close) || low > high
  ) {
    throw new Error('Binance candle contains inconsistent OHLC prices.')
  }
  if (volume < 0 || quoteVolume < 0) throw new Error('Binance candle contains negative volume.')
  return { time, open, high, low, close, volume, quoteVolume, isFinal }
}

export function parseMarketKlinesResponse(
  payload: unknown,
  interval: MarketCandleInterval,
): MarketCandle[] {
  if (!Array.isArray(payload)) throw new Error('Binance returned an invalid candle response.')
  const candles = payload.map((row) => {
    if (!Array.isArray(row) || row.length < 8) {
      throw new Error('Binance returned a malformed candle row.')
    }
    if (
      typeof row[0] !== 'number'
      || typeof row[6] !== 'number'
      || !Number.isSafeInteger(row[6])
      || row[6] < row[0]
      || row[6] >= row[0] + timeframeSeconds(interval) * 1_000
    ) {
      throw new Error('Binance candle has an invalid close timestamp.')
    }
    return normalizeCandle(
      row[0],
      row[1],
      row[2],
      row[3],
      row[4],
      row[5],
      row[7],
      interval,
      row[6] < Date.now(),
    )
  })

  const sorted = [...candles].sort((left, right) => left.time - right.time)
  return sorted.reduce<MarketCandle[]>((result, candle) => {
    if (result.at(-1)?.time === candle.time) result[result.length - 1] = candle
    else result.push(candle)
    return result
  }, [])
}

export function parseMarketKlineMessage(
  message: unknown,
  expectedInterval: MarketCandleInterval,
): MarketCandleUpdate {
  if (typeof message !== 'string') throw new Error('Binance kline message must be text.')

  let payload: unknown
  try {
    payload = JSON.parse(message)
  } catch {
    throw new Error('Binance kline message is not valid JSON.')
  }
  if (isRecord(payload) && 'data' in payload) payload = payload.data
  if (!isRecord(payload) || payload.e !== 'kline' || payload.s !== BINANCE_SYMBOL || !isRecord(payload.k)) {
    throw new Error('Binance returned an unexpected kline message.')
  }
  const kline = payload.k
  const isFinal = kline.x
  if (kline.i !== expectedInterval || typeof isFinal !== 'boolean') {
    throw new Error('Binance kline message has an unexpected interval or finality flag.')
  }

  return {
    symbol: BINANCE_SYMBOL,
    interval: expectedInterval,
    candle: normalizeCandle(
      kline.t,
      kline.o,
      kline.h,
      kline.l,
      kline.c,
      kline.v,
      kline.q,
      expectedInterval,
      isFinal,
    ),
  }
}

export function mergeMarketCandle(candles: MarketCandle[], incoming: MarketCandle): MarketCandle[] {
  const last = candles.at(-1)
  if (last && incoming.time < last.time) return candles
  if (last && incoming.time === last.time) {
    if (last.isFinal && !incoming.isFinal) return candles
    return [...candles.slice(0, -1), incoming]
  }
  return [...candles, incoming]
}

export function applyLiveMarketCandleUpdate(
  candles: MarketCandle[],
  incoming: MarketCandle,
  receivedAt: number,
): { candles: MarketCandle[]; lastReceivedAt: number } {
  return {
    candles: mergeMarketCandle(candles, incoming),
    lastReceivedAt: receivedAt,
  }
}

export function mergeMarketCandles(
  candles: MarketCandle[],
  updates: MarketCandle[],
): MarketCandle[] {
  return updates.reduce(mergeMarketCandle, candles)
}

export function formatMarketCandleForPair(candle: MarketCandle, pair: MarketPair): MarketCandle {
  if (pair === 'ETH/BTC') return candle
  return {
    time: candle.time,
    open: 1 / candle.open,
    high: 1 / candle.low,
    low: 1 / candle.high,
    close: 1 / candle.close,
    volume: candle.quoteVolume,
    quoteVolume: candle.volume,
    isFinal: candle.isFinal,
  }
}

export async function getHistoricalMarketCandles(
  pair: MarketPair,
  interval: MarketCandleInterval,
  signal?: AbortSignal,
): Promise<MarketCandle[]> {
  const params = new URLSearchParams({ symbol: BINANCE_SYMBOL, interval, limit: '500' })
  let response: Response
  try {
    response = await fetch(`${BINANCE_KLINES_URL}?${params}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    const message = error instanceof Error ? `Unable to reach Binance: ${error.message}` : 'Unable to reach Binance.'
    throw new Error(message, { cause: error })
  }
  if (!response.ok) throw new Error(`Binance kline request failed (${response.status}).`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Binance returned invalid candle JSON (${response.status}).`)
  }

  return parseMarketKlinesResponse(payload, interval).map((candle) => formatMarketCandleForPair(candle, pair))
}

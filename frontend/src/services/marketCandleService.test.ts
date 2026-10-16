import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyLiveMarketCandleUpdate,
  formatMarketCandleForPair,
  getHistoricalMarketCandles,
  isMarketDataStale,
  MARKET_CANDLE_INTERVALS,
  MARKET_CANDLE_STALE_MS,
  mergeMarketCandle,
  mergeMarketCandles,
  parseMarketKlineMessage,
  parseMarketKlinesResponse,
} from './marketCandleService'

const baseTime = 1_728_000_000_000
const validRow = (time = baseTime) => [time, '0.05', '0.06', '0.04', '0.055', '12', time + 59_999, '0.66']

describe('marketCandleService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('parses and sorts Binance historical OHLCV rows', () => {
    const candles = parseMarketKlinesResponse([validRow(baseTime + 60_000), validRow()], '1m')
    expect(candles).toEqual([
      {
        time: baseTime / 1_000,
        open: 0.05,
        high: 0.06,
        low: 0.04,
        close: 0.055,
        volume: 12,
        quoteVolume: 0.66,
        isFinal: true,
      },
      expect.objectContaining({ time: (baseTime + 60_000) / 1_000 }),
    ])
  })

  it('rejects malformed responses, OHLC values, volume, and misaligned timestamps', () => {
    expect(() => parseMarketKlinesResponse({}, '1m')).toThrow('invalid candle response')
    expect(() => parseMarketKlinesResponse([['short']], '1m')).toThrow('malformed candle row')
    expect(() => parseMarketKlinesResponse([validRow().map((value, index) => index === 2 ? '0.03' : value)], '1m'))
      .toThrow('inconsistent OHLC')
    expect(() => parseMarketKlinesResponse([validRow().map((value, index) => index === 5 ? '-1' : value)], '1m'))
      .toThrow('negative volume')
    expect(() => parseMarketKlinesResponse([validRow(baseTime + 1_000)], '5m')).toThrow('not aligned to 5m')
  })

  it('parses combined live kline messages and validates symbol and timeframe', () => {
    const message = JSON.stringify({
      stream: 'ethbtc@kline_1m',
      data: {
        e: 'kline',
        s: 'ETHBTC',
        k: { t: baseTime, i: '1m', o: '0.05', h: '0.06', l: '0.04', c: '0.055', v: '12', q: '0.66', x: false },
      },
    })
    expect(parseMarketKlineMessage(message, '1m')).toMatchObject({
      symbol: 'ETHBTC',
      interval: '1m',
      candle: { time: baseTime / 1_000, close: 0.055, isFinal: false },
    })
    expect(() => parseMarketKlineMessage(message, '5m')).toThrow('unexpected interval')
    expect(() => parseMarketKlineMessage('{', '1m')).toThrow('not valid JSON')
    expect(() => parseMarketKlineMessage('{}', '1m')).toThrow('unexpected kline')
  })

  it('updates the current candle, ignores older events, and preserves finalized candles', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(baseTime + 30_000)
    const current = parseMarketKlinesResponse([validRow()], '1m')[0]
    const update = { ...current, close: 0.057, high: 0.057, isFinal: false }
    expect(mergeMarketCandle([current], update)).toEqual([update])
    expect(mergeMarketCandle([current], { ...current, time: current.time - 60 })).toEqual([current])
    expect(mergeMarketCandle([{ ...current, isFinal: true }], update)).toEqual([{ ...current, isFinal: true }])
    expect(mergeMarketCandle([current], { ...current, time: current.time + 60 })).toHaveLength(2)
    expect(now).toHaveBeenCalled()
  })

  it('advances last-received time for valid updates even when finalized or older candles are unchanged', () => {
    const candle = parseMarketKlinesResponse([validRow()], '1m')[0]
    const finalized = { ...candle, isFinal: true }
    const partialUpdate = { ...candle, close: 0.057, isFinal: false }
    const previous = applyLiveMarketCandleUpdate([finalized], partialUpdate, 1_800_000_000_010)

    expect(previous.candles).toEqual([finalized])
    expect(previous.lastReceivedAt).toBe(1_800_000_000_010)

    const outOfOrder = applyLiveMarketCandleUpdate(
      [candle],
      { ...candle, time: candle.time - 60 },
      1_800_000_000_020,
    )
    expect(outOfOrder.candles).toEqual([candle])
    expect(outOfOrder.lastReceivedAt).toBe(1_800_000_000_020)
  })

  it('retains historical candles when the live candle arrives before the REST response', () => {
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 90_000)
    const history = parseMarketKlinesResponse([validRow(), validRow(baseTime + 60_000)], '1m')
    const live = { ...history[1], close: 0.057, high: 0.057, isFinal: false }
    expect(mergeMarketCandles(history, [live])).toEqual([history[0], live])
  })

  it('marks feed freshness from millisecond receipt times, never from historical candle timestamps', () => {
    const feedStartedAt = 1_800_000_000_000
    expect(isMarketDataStale(null, feedStartedAt, feedStartedAt + MARKET_CANDLE_STALE_MS)).toBe(false)
    expect(isMarketDataStale(null, feedStartedAt, feedStartedAt + MARKET_CANDLE_STALE_MS + 1)).toBe(true)

    const receivedAt = feedStartedAt + 90_000
    expect(isMarketDataStale(receivedAt, feedStartedAt, receivedAt + MARKET_CANDLE_STALE_MS)).toBe(false)
    expect(isMarketDataStale(receivedAt, feedStartedAt, receivedAt + MARKET_CANDLE_STALE_MS + 1)).toBe(true)
  })

  it('inverts BTC/ETH prices and uses Binance quote volume as BTC base volume', () => {
    expect(formatMarketCandleForPair(parseMarketKlinesResponse([validRow()], '1m')[0], 'BTC/ETH')).toMatchObject({
      open: 20,
      high: 25,
      low: 1 / 0.06,
      close: 1 / 0.055,
      volume: 0.66,
      quoteVolume: 12,
    })
    expect(MARKET_CANDLE_INTERVALS).toEqual(['1m', '5m', '15m'])
  })

  it('requests Binance klines with the market symbol and selected timeframe', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([validRow()]), { status: 200 }))
    await expect(getHistoricalMarketCandles('ETH/BTC', '15m')).resolves.toHaveLength(1)
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://api.binance.com/api/v3/klines')
    expect(url.searchParams.get('symbol')).toBe('ETHBTC')
    expect(url.searchParams.get('interval')).toBe('15m')
    expect(url.searchParams.get('limit')).toBe('500')
  })

  it('reports HTTP, network, and invalid JSON failures', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 429 }))
    await expect(getHistoricalMarketCandles('ETH/BTC', '1m')).rejects.toThrow('Binance kline request failed (429)')

    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'))
    await expect(getHistoricalMarketCandles('ETH/BTC', '1m')).rejects.toThrow('Unable to reach Binance: network unavailable')

    vi.mocked(fetch).mockResolvedValue(new Response('not JSON', { status: 200 }))
    await expect(getHistoricalMarketCandles('ETH/BTC', '1m')).rejects.toThrow('invalid candle JSON')
  })
})

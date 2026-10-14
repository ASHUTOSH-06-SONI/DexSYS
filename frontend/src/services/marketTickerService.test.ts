import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMarketTickerRetryDelay,
  MARKET_TICKER_MAX_RETRY_MS,
  parseMarketTickerMessage,
  subscribeToMarketTicker,
  transitionMarketConnectionStatus,
} from './marketTickerService'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  onopen: WebSocket['onopen'] = null
  onmessage: WebSocket['onmessage'] = null
  onerror: WebSocket['onerror'] = null
  onclose: WebSocket['onclose'] = null

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  close() {
    if (this.readyState >= FakeWebSocket.CLOSING) return
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.call(this as unknown as WebSocket, {} as CloseEvent)
  }

  send() {}

  emitMessage(data: unknown) {
    this.onmessage?.call(this as unknown as WebSocket, { data } as MessageEvent)
  }
}

describe('marketTickerService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('parses the ETHBTC last price from a Binance ticker message', () => {
    expect(parseMarketTickerMessage(JSON.stringify({
      e: '24hrTicker',
      s: 'ETHBTC',
      c: '0.02999000',
    }))).toEqual({ symbol: 'ETHBTC', price: 0.02999 })
  })

  it.each([
    ['invalid JSON', '{'],
    ['binary data', new ArrayBuffer(8)],
    ['unexpected symbol', JSON.stringify({ e: '24hrTicker', s: 'BTCETH', c: '0.03' })],
    ['invalid price', JSON.stringify({ e: '24hrTicker', s: 'ETHBTC', c: '0' })],
  ])('rejects %s', (_description, message) => {
    expect(() => parseMarketTickerMessage(message)).toThrow()
  })

  it('moves through live, reconnecting, and disconnected states', () => {
    expect(transitionMarketConnectionStatus('connecting', 'ticker')).toBe('live')
    expect(transitionMarketConnectionStatus('live', 'connection-failed')).toBe('reconnecting')
    expect(transitionMarketConnectionStatus('reconnecting', 'retry-exhausted')).toBe('disconnected')
    expect(transitionMarketConnectionStatus('disconnected', 'manual-retry')).toBe('connecting')
  })

  it('uses exponential retry delays with a fixed maximum', () => {
    expect(getMarketTickerRetryDelay(1)).toBe(1_000)
    expect(getMarketTickerRetryDelay(2)).toBe(2_000)
    expect(getMarketTickerRetryDelay(5)).toBe(16_000)
    expect(getMarketTickerRetryDelay(8)).toBe(MARKET_TICKER_MAX_RETRY_MS)
    expect(getMarketTickerRetryDelay(20)).toBe(MARKET_TICKER_MAX_RETRY_MS)
  })

  it('ignores malformed frames, reconnects after closure, and cleans up on unsubscribe', () => {
    const onStatus = vi.fn()
    const onTicker = vi.fn()
    const unsubscribe = subscribeToMarketTicker({ onStatus, onTicker })
    const firstSocket = FakeWebSocket.instances[0]

    firstSocket.emitMessage('{')
    expect(onTicker).not.toHaveBeenCalled()
    firstSocket.emitMessage(JSON.stringify({ e: '24hrTicker', s: 'ETHBTC', c: '0.03' }))
    expect(onTicker).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ETHBTC', price: 0.03 }))
    expect(onStatus).toHaveBeenLastCalledWith('live')

    firstSocket.close()
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting')
    vi.advanceTimersByTime(getMarketTickerRetryDelay(1))
    expect(FakeWebSocket.instances).toHaveLength(2)

    unsubscribe()
    vi.advanceTimersByTime(MARKET_TICKER_MAX_RETRY_MS)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.instances[1].onmessage).toBeNull()
  })
})

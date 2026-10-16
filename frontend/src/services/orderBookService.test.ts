import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrderBookDepth, parseOrderBookDepth } from './orderBookService'

const depth = {
  trading_pair: 'ETH/BTC',
  bids: [
    { price: '0.05', quantity: '1.25', cumulative_quantity: '1.25' },
    { price: '0.04', quantity: '2', cumulative_quantity: '3.25' },
  ],
  asks: [
    { price: '0.06', quantity: '0.75', cumulative_quantity: '0.75' },
    { price: '0.07', quantity: '1', cumulative_quantity: '1.75' },
  ],
}

describe('orderBookService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('loads sorted levels with cumulative quantities from the public API', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(depth), { status: 200 }))

    await expect(getOrderBookDepth('ETH/BTC')).resolves.toEqual(depth)
    expect(fetch).toHaveBeenCalledWith('/api/market/depth/ETH/BTC', expect.objectContaining({
      method: 'GET',
      headers: { Accept: 'application/json' },
    }))
  })

  it('accepts an honestly empty order book', () => {
    expect(parseOrderBookDepth({ trading_pair: 'ETH/BTC', bids: [], asks: [] }, 'ETH/BTC')).toEqual({
      trading_pair: 'ETH/BTC',
      bids: [],
      asks: [],
    })
  })

  it('validates fixed-point cumulative sums without floating-point rounding', () => {
    const fixedPointDepth = {
      trading_pair: 'ETH/BTC',
      bids: [
        { price: '0.05', quantity: '9007199254.740991', cumulative_quantity: '9007199254.740991' },
        { price: '0.04', quantity: '0.000001', cumulative_quantity: '9007199254.740992' },
      ],
      asks: [],
    }
    expect(parseOrderBookDepth(fixedPointDepth, 'ETH/BTC')).toEqual(fixedPointDepth)
  })

  it('rejects malformed levels, invalid ordering, cumulative quantities, and a mismatched pair', () => {
    expect(() => parseOrderBookDepth({ ...depth, bids: 'invalid' }, 'ETH/BTC')).toThrow('invalid order-book side')
    expect(() => parseOrderBookDepth({
      ...depth,
      asks: [
        { price: '0.07', quantity: '0.75', cumulative_quantity: '0.75' },
        { price: '0.06', quantity: '1', cumulative_quantity: '1.75' },
      ],
    }, 'ETH/BTC')).toThrow('invalid price order')
    expect(() => parseOrderBookDepth({
      ...depth,
      bids: [{ price: '0.05', quantity: '2', cumulative_quantity: '1' }],
    }, 'ETH/BTC')).toThrow('invalid order-book quantities')
    expect(() => parseOrderBookDepth(depth, 'BTC/ETH')).toThrow('unexpected trading pair')
  })

  it('surfaces API errors and rejects malformed pairs without requesting', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Depth unavailable' }), { status: 503 }))
    await expect(getOrderBookDepth('ETH/BTC')).rejects.toMatchObject({ message: 'Depth unavailable', status: 503 })
    await expect(getOrderBookDepth('ETH/BTC/USDC')).rejects.toThrow('valid trading pair')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

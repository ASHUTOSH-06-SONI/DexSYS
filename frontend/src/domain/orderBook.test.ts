import { describe, expect, it } from 'vitest'
import { getDemoOrderBook } from './orderBook'

describe('getDemoOrderBook', () => {
  it('returns a balanced demo order book with formatted prices and quantities', () => {
    const book = getDemoOrderBook('ETH / USDC')

    expect(book.bids[0]).toEqual({ price: '$2,485.50', quantity: '0.80 ETH' })
    expect(book.asks[0]).toEqual({ price: '$2,488.20', quantity: '0.65 ETH' })
    expect(book.bids).toHaveLength(3)
    expect(book.asks).toHaveLength(3)
  })
})

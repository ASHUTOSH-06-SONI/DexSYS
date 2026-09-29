import { describe, expect, it } from 'vitest'
import { DEMO_TOKENS } from '../data/demoData'
import { getVisibleMarkets, selectMarketToken } from './marketSelection'

describe('getVisibleMarkets', () => {
  it('searches names and symbols without case sensitivity', () => {
    expect(getVisibleMarkets(DEMO_TOKENS, 'bit', 'all').map((token) => token.symbol)).toEqual(['WBTC'])
  })

  it('returns the strongest percentage movers first', () => {
    expect(getVisibleMarkets(DEMO_TOKENS, '', 'movers').map((token) => token.symbol)).toEqual(['ETH', 'WBTC'])
  })

  it('returns an empty result when no asset matches', () => {
    expect(getVisibleMarkets(DEMO_TOKENS, 'unknown', 'all')).toEqual([])
  })
})

describe('selectMarketToken', () => {
  it('selects the market and preserves distinct pay and receive tokens', () => {
    expect(selectMarketToken('WBTC', 'ETH', 'USDC', DEMO_TOKENS)).toEqual({
      selectedToken: 'WBTC',
      fromToken: 'WBTC',
      toToken: 'USDC',
    })
  })

  it('moves the prior pay token to receive when selecting the current receive token', () => {
    expect(selectMarketToken('USDC', 'ETH', 'USDC', DEMO_TOKENS)).toEqual({
      selectedToken: 'USDC',
      fromToken: 'USDC',
      toToken: 'ETH',
    })
  })
})

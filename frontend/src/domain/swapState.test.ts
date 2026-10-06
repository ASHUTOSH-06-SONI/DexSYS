import { describe, expect, it } from 'vitest'
import { getMaxAmount, reverseTokenPair } from './swapState'

describe('swap state helpers', () => {
  it('returns the available balance as the MAX amount', () => {
    expect(getMaxAmount(1.25)).toBe('1.25')
    expect(getMaxAmount(Number.NaN)).toBe('0')
    expect(getMaxAmount(0)).toBe('0')
  })

  it('reverses the selected pay and receive tokens', () => {
    expect(reverseTokenPair({ fromToken: 'ETH', toToken: 'BTC' })).toEqual({ fromToken: 'BTC', toToken: 'ETH' })
  })
})

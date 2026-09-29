import { describe, expect, it } from 'vitest'
import { DEMO_TOKENS } from '../data/demoData'
import { calculateSwapQuote } from './swapQuote'

describe('calculateSwapQuote', () => {
  it('converts ETH to USDC using indicative prices', () => {
    expect(calculateSwapQuote('0.2', DEMO_TOKENS[0], DEMO_TOKENS[1])).toBe('497.24')
  })

  it('supports pairs that are not hardcoded by symbol', () => {
    expect(calculateSwapQuote('0.2', DEMO_TOKENS[0], DEMO_TOKENS[2])).toBe('0.00774397')
  })

  it('returns a zero quote for invalid, non-positive, or empty input', () => {
    expect(calculateSwapQuote('', DEMO_TOKENS[0], DEMO_TOKENS[1])).toBe('0.00')
    expect(calculateSwapQuote('-1', DEMO_TOKENS[0], DEMO_TOKENS[1])).toBe('0.00')
  })
})

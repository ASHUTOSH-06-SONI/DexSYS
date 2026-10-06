import type { Token } from '../types'

function numericPrice(price: string) {
  return Number(price.replace(/[^\d.-]/g, ''))
}

export function calculateSwapQuote(amount: string, from: Token, to: Token) {
  const value = Number.parseFloat(amount)
  const fromPrice = numericPrice(from.price)
  const toPrice = numericPrice(to.price)

  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(fromPrice) || fromPrice <= 0 || !Number.isFinite(toPrice) || toPrice <= 0) {
    return '0.00'
  }

  const quote = value * fromPrice / toPrice
  if (!Number.isFinite(quote)) return '0.00'

  const precision = to.symbol === 'USDC' ? 2 : to.symbol === 'ETH' ? 6 : 8
  return quote.toFixed(precision)
}

import type { Token } from '../types'

export type MarketFilter = 'all' | 'movers'

function percentChange(change: string) {
  return Number(change.replace('%', ''))
}

export function getVisibleMarkets(tokens: Token[], query: string, filter: MarketFilter) {
  const normalizedQuery = query.trim().toLowerCase()
  const matchingTokens = tokens.filter((token) => `${token.symbol} ${token.name}`.toLowerCase().includes(normalizedQuery))

  if (filter === 'all') return matchingTokens
  return [...matchingTokens].sort((left, right) => Math.abs(percentChange(right.change)) - Math.abs(percentChange(left.change))).slice(0, 2)
}

export function selectMarketToken(symbol: string, fromToken: string, toToken: string, tokens: Token[]) {
  if (!tokens.some((token) => token.symbol === symbol)) return { selectedToken: symbol, fromToken, toToken }

  const nextToToken = symbol === toToken
    ? fromToken === symbol ? tokens.find((token) => token.symbol !== symbol)?.symbol ?? symbol : fromToken
    : toToken

  return { selectedToken: symbol, fromToken: symbol, toToken: nextToToken }
}

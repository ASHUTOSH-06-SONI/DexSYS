export type TokenPair = { fromToken: string; toToken: string }

export function reverseTokenPair(pair: TokenPair): TokenPair {
  return { fromToken: pair.toToken, toToken: pair.fromToken }
}

export function getMaxAmount(balance: number) {
  return Number.isFinite(balance) && balance > 0 ? String(balance) : '0'
}

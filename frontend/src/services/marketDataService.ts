import type { Token } from '../types'

export const MARKET_PRICE_SYMBOLS = ['ETH', 'BTC', 'USDC', 'WBTC'] as const
export const MARKET_PRICE_REFRESH_MS = 60_000

export type MarketPrice = {
  priceUsd: number
  change24h: number
}

type MarketSymbol = (typeof MARKET_PRICE_SYMBOLS)[number]
export type MarketPrices = Partial<Record<MarketSymbol, MarketPrice>>

const COINGECKO_IDS: Record<MarketSymbol, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  USDC: 'usd-coin',
  WBTC: 'wrapped-bitcoin',
}
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price'

function isMarketSymbol(symbol: string): symbol is MarketSymbol {
  return Object.hasOwn(COINGECKO_IDS, symbol)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMarketPrice(value: unknown, id: string): MarketPrice {
  if (!isRecord(value)) throw new Error(`CoinGecko response is missing ${id}.`)
  const priceUsd = value.usd
  const change24h = value.usd_24h_change
  if (typeof priceUsd !== 'number' || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error(`CoinGecko returned an invalid USD price for ${id}.`)
  }
  if (typeof change24h !== 'number' || !Number.isFinite(change24h)) {
    throw new Error(`CoinGecko returned an invalid 24-hour change for ${id}.`)
  }
  return { priceUsd, change24h }
}

export async function getMarketPrices(
  symbols: readonly string[] = MARKET_PRICE_SYMBOLS,
  signal?: AbortSignal,
): Promise<MarketPrices> {
  if (symbols.length === 0) throw new Error('No supported symbols were requested from CoinGecko.')

  const mappedSymbols = symbols.map((symbol) => {
    if (!isMarketSymbol(symbol)) throw new Error(`CoinGecko mapping is unavailable for ${symbol}.`)
    return { symbol, id: COINGECKO_IDS[symbol] }
  })
  const ids = [...new Set(mappedSymbols.map(({ id }) => id))]
  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  })
  let response: Response
  try {
    response = await fetch(`${COINGECKO_URL}?${params}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    const message = error instanceof Error ? `Unable to reach CoinGecko: ${error.message}` : 'Unable to reach CoinGecko.'
    throw new Error(message, { cause: error })
  }

  if (!response.ok) throw new Error(`CoinGecko API request failed (${response.status}).`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error(`CoinGecko returned invalid JSON (${response.status}).`)
  }
  if (!isRecord(payload)) throw new Error('CoinGecko returned an invalid market-data response.')

  return Object.fromEntries(mappedSymbols.map(({ symbol, id }) => [symbol, parseMarketPrice(payload[id], id)]))
}

export function applyMarketPrices(tokens: Token[], prices: MarketPrices): Token[] {
  return tokens.map((token) => {
    const marketPrice = isMarketSymbol(token.symbol) ? prices[token.symbol] : undefined
    if (!marketPrice) return token

    return {
      ...token,
      price: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }).format(marketPrice.priceUsd),
      change: `${marketPrice.change24h >= 0 ? '+' : ''}${marketPrice.change24h.toFixed(2)}%`,
    }
  })
}

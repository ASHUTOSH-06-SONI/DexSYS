import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_TOKENS } from '../data/demoData'
import { applyMarketPrices, getMarketPrices, MARKET_PRICE_SYMBOLS } from './marketDataService'

const coingeckoResponse = {
  ethereum: { usd: 3500, usd_24h_change: 2.4 },
  bitcoin: { usd: 75800, usd_24h_change: -1.25 },
  'usd-coin': { usd: 1, usd_24h_change: 0.01 },
  'wrapped-bitcoin': { usd: 75810, usd_24h_change: -1.2 },
}

describe('marketDataService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('fetches mapped USD prices and 24-hour changes from CoinGecko', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(coingeckoResponse), { status: 200 }))

    await expect(getMarketPrices()).resolves.toEqual({
      ETH: { priceUsd: 3500, change24h: 2.4 },
      BTC: { priceUsd: 75800, change24h: -1.25 },
      USDC: { priceUsd: 1, change24h: 0.01 },
      WBTC: { priceUsd: 75810, change24h: -1.2 },
    })
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://api.coingecko.com/api/v3/simple/price')
    expect(url.searchParams.get('ids')).toBe('ethereum,bitcoin,usd-coin,wrapped-bitcoin')
    expect(url.searchParams.get('vs_currencies')).toBe('usd')
    expect(url.searchParams.get('include_24hr_change')).toBe('true')
  })

  it('rejects missing and malformed market data', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ethereum: { usd: 0 } }), { status: 200 }))
    await expect(getMarketPrices(['ETH'])).rejects.toThrow('invalid USD price')

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await expect(getMarketPrices(['BTC'])).rejects.toThrow('missing bitcoin')
  })

  it('rejects unsupported symbols before making a provider request', async () => {
    await expect(getMarketPrices(['DOGE'])).rejects.toThrow('mapping is unavailable for DOGE')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports provider HTTP and network failures', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 429 }))
    await expect(getMarketPrices(['ETH'])).rejects.toThrow('CoinGecko API request failed (429)')

    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'))
    await expect(getMarketPrices(['ETH'])).rejects.toThrow('Unable to reach CoinGecko: network unavailable')
  })

  it('replaces fallback display prices while preserving sample balances and unmapped tokens', () => {
    const prices = {
      ETH: { priceUsd: 3600.25, change24h: 3.125 },
      USDC: { priceUsd: 1, change24h: -0.02 },
    }

    const tokens = applyMarketPrices(DEMO_TOKENS, prices)
    expect(tokens[0]).toMatchObject({ price: '$3,600.25', change: '+3.13%', balance: DEMO_TOKENS[0].balance })
    expect(tokens[1]).toMatchObject({ price: '$1.00', change: '-0.02%', balance: DEMO_TOKENS[1].balance })
    expect(tokens[2]).toEqual(DEMO_TOKENS[2])
    expect(MARKET_PRICE_SYMBOLS).toContain('WBTC')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMarketTokens, getTokenInfo, parseTokenInfo } from './tokenService'

const ethResponse = {
  symbol: 'ETH',
  name: 'Ethereum',
  validated: true,
  price: 3500,
  change_24h: 2.4,
  balance: 1.25,
  contract_address: '0x...',
  supported_pairs: ['USDC', 'WBTC'],
}

describe('tokenService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('validates and maps the Rust token response shape', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(ethResponse), { status: 200 }))

    await expect(getTokenInfo('ETH')).resolves.toMatchObject({
      symbol: 'ETH',
      price: '$3,500.00',
      change: '+2.40%',
      pairs: ['ETH / USDC', 'ETH / WBTC'],
      validation: 'Validated',
    })
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/tokens/ETH')
  })

  it('rejects malformed token payloads', () => {
    expect(() => parseTokenInfo({ ...ethResponse, price: '3500' })).toThrow('price to be a finite number')
  })

  it('reports invalid JSON from the API', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not-json', { status: 200 }))

    await expect(getTokenInfo('ETH')).rejects.toThrow('returned invalid JSON (200)')
  })

  it('preserves API error messages and status codes', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Token Not Found' }), { status: 404 }))

    await expect(getTokenInfo('DOGE')).rejects.toMatchObject({ message: 'Token Not Found', status: 404 })
  })

  it('requests only the token symbols currently seeded by the backend', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(ethResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...ethResponse, symbol: 'BTC', name: 'Bitcoin' }), { status: 200 }))

    await expect(getMarketTokens()).resolves.toHaveLength(2)
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/tokens/ETH', '/api/tokens/BTC'])
  })

  it('reports network failures without pretending the API is connected', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'))

    await expect(getTokenInfo('ETH')).rejects.toThrow('Unable to reach DexSYS API')
  })
})

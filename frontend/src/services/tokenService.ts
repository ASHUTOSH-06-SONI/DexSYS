import { ApiError, getJson } from './apiClient'
import type { Token } from '../types'

export const API_MARKET_SYMBOLS = ['ETH', 'BTC'] as const

export type TokenInfoResponse = {
  symbol: string
  name: string
  validated: boolean
  price: number
  change_24h: number
  balance: number
  contract_address: string
  supported_pairs: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Expected ${field} to be a non-empty string.`)
  return value
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Expected ${field} to be a finite number.`)
  return value
}

export function parseTokenInfo(value: unknown): TokenInfoResponse {
  if (!isRecord(value)) throw new Error('Expected an object.')
  if (typeof value.validated !== 'boolean') throw new Error('Expected validated to be a boolean.')
  if (!Array.isArray(value.supported_pairs) || !value.supported_pairs.every((pair) => typeof pair === 'string')) {
    throw new Error('Expected supported_pairs to be an array of strings.')
  }

  return {
    symbol: requiredString(value.symbol, 'symbol'),
    name: requiredString(value.name, 'name'),
    validated: value.validated,
    price: requiredNumber(value.price, 'price'),
    change_24h: requiredNumber(value.change_24h, 'change_24h'),
    balance: requiredNumber(value.balance, 'balance'),
    contract_address: requiredString(value.contract_address, 'contract_address'),
    supported_pairs: value.supported_pairs,
  }
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
}

function toToken(info: TokenInfoResponse): Token {
  const change = `${info.change_24h >= 0 ? '+' : ''}${info.change_24h.toFixed(2)}%`
  const icon = info.symbol === 'ETH' ? 'Ξ' : info.symbol === 'BTC' ? '₿' : info.symbol.slice(0, 1)

  return {
    symbol: info.symbol,
    name: info.name,
    balance: info.balance,
    icon,
    address: info.contract_address,
    price: formatPrice(info.price),
    change,
    pairs: info.supported_pairs.map((pair) => `${info.symbol} / ${pair}`),
    validation: info.validated ? 'Validated' : 'Unsupported',
    note: 'Token metadata returned by the DexSYS API. Current backend values are seeded in AppState.',
  }
}

export async function getTokenInfo(symbol: string, signal?: AbortSignal): Promise<Token> {
  const response = await getJson(`/tokens/${encodeURIComponent(symbol)}`, parseTokenInfo, signal)
  return toToken(response)
}

export async function getMarketTokens(signal?: AbortSignal): Promise<Token[]> {
  const tokens = await Promise.all(API_MARKET_SYMBOLS.map((symbol) => getTokenInfo(symbol, signal)))
  if (tokens.length === 0) throw new ApiError('The DexSYS API returned no tokens.')
  return tokens
}

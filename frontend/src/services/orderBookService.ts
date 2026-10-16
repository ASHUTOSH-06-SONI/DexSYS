import { getJson } from './apiClient'

export interface DepthLevel {
  price: string
  quantity: string
  cumulative_quantity: string
}

export interface OrderBookDepth {
  trading_pair: string
  bids: DepthLevel[]
  asks: DepthLevel[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decimalString(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error('Order-book levels must use non-negative decimal strings.')
  }
  if (!Number.isFinite(Number(value))) throw new Error('Order-book levels contain an invalid decimal value.')
  return value
}

function decimalUnits(value: string, precision: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > precision) throw new Error('The API returned a value beyond the market fixed-point precision.')
  return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0')
}

function parseSide(value: unknown, side: 'bid' | 'ask'): DepthLevel[] {
  if (!Array.isArray(value)) throw new Error('The API returned an invalid order-book side.')
  let previousPrice: bigint | undefined
  let previousCumulative = 0n
  return value.map((item) => {
    if (!isRecord(item)) throw new Error('The API returned an invalid order-book level.')
    const priceText = decimalString(item.price)
    const quantityText = decimalString(item.quantity)
    const cumulativeText = decimalString(item.cumulative_quantity)
    const price = decimalUnits(priceText, 2)
    const quantity = decimalUnits(quantityText, 6)
    const cumulative = decimalUnits(cumulativeText, 6)
    if (price <= 0n || quantity <= 0n || cumulative !== previousCumulative + quantity) {
      throw new Error('The API returned invalid order-book quantities.')
    }
    if (previousPrice !== undefined && (side === 'bid' ? price >= previousPrice : price <= previousPrice)) {
      throw new Error('The API returned order-book levels in an invalid price order.')
    }
    previousPrice = price
    previousCumulative = cumulative
    return {
      price: priceText,
      quantity: quantityText,
      cumulative_quantity: cumulativeText,
    }
  })
}

export function parseOrderBookDepth(value: unknown, expectedPair: string): OrderBookDepth {
  if (!isRecord(value) || value.trading_pair !== expectedPair) {
    throw new Error('The API returned an order book for an unexpected trading pair.')
  }
  return {
    trading_pair: expectedPair,
    bids: parseSide(value.bids, 'bid'),
    asks: parseSide(value.asks, 'ask'),
  }
}

export function getOrderBookDepth(pair: string, signal?: AbortSignal): Promise<OrderBookDepth> {
  const [base, quote, ...extra] = pair.split('/')
  if (!base || !quote || extra.length > 0) {
    return Promise.reject(new Error('A valid trading pair is required to load order-book depth.'))
  }
  return getJson(
    `/market/depth/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`,
    (value) => parseOrderBookDepth(value, pair),
    signal,
  )
}

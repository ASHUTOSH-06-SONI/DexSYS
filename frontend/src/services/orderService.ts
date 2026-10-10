import { getJson, postJson } from './apiClient'

export type ApiOrderSide = 'Buy' | 'Sell'
export type ApiOrderType = 'Limit' | 'Market'
export type ApiOrderStatus = 'Pending' | 'Filled' | 'Cancelled'

export interface Order {
  id: string
  user_id: string
  trading_pair: string
  side: ApiOrderSide
  order_type: ApiOrderType
  price: number | null
  quantity: number
  status: ApiOrderStatus
}

export interface CreateOrder {
  id: string
  user_id: string
  trading_pair: string
  side: ApiOrderSide
  order_type: ApiOrderType
  price: number | null
  quantity: number
  status: 'Pending'
}

function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') return false
  const order = value as Record<string, unknown>
  return typeof order.id === 'string'
    && typeof order.user_id === 'string'
    && typeof order.trading_pair === 'string'
    && (order.side === 'Buy' || order.side === 'Sell')
    && (order.order_type === 'Limit' || order.order_type === 'Market')
    && (order.price === null || (typeof order.price === 'number' && Number.isFinite(order.price)))
    && typeof order.quantity === 'number' && Number.isFinite(order.quantity)
    && (order.status === 'Pending' || order.status === 'Filled' || order.status === 'Cancelled')
}

function parseOrder(value: unknown): Order {
  if (!isOrder(value)) throw new Error('The API returned an invalid order.')
  return value
}

function parseOrders(value: unknown): Order[] {
  if (!Array.isArray(value)) throw new Error('The API returned an invalid order list.')
  return value.map(parseOrder)
}

export function listOrders(signal?: AbortSignal): Promise<Order[]> {
  return getJson('/orders', parseOrders, signal)
}

export function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  return getJson(`/orders/${encodeURIComponent(id)}`, parseOrder, signal)
}

export function createOrder(order: CreateOrder, signal?: AbortSignal): Promise<Order> {
  if (order.order_type === 'Market') {
    return Promise.reject(new Error('Market orders are not supported by the backend.'))
  }
  return postJson('/orders', order, parseOrder, signal)
}

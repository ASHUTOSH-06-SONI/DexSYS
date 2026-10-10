import { describe, expect, it } from 'vitest'
import { activityFilters, filterOrders } from './orderActivity'
import type { Order } from '../services/orderService'

const orders: Order[] = [
  { id: 'open', user_id: 'user', trading_pair: 'ETH/BTC', side: 'Buy', order_type: 'Limit', price: 0.05, quantity: 2, status: 'Pending' },
  { id: 'filled', user_id: 'user', trading_pair: 'ETH/BTC', side: 'Sell', order_type: 'Limit', price: 0.06, quantity: 1, status: 'Filled' },
  { id: 'cancelled', user_id: 'user', trading_pair: 'BTC/ETH', side: 'Buy', order_type: 'Limit', price: 20, quantity: 3, status: 'Cancelled' },
]

describe('order activity filters', () => {
  it('provides the supported status filters', () => {
    expect(activityFilters).toEqual(['All', 'Open', 'Filled', 'Cancelled'])
  })

  it('maps Open to the backend Pending status without changing other results', () => {
    expect(filterOrders(orders, 'All')).toEqual(orders)
    expect(filterOrders(orders, 'Open').map((order) => order.id)).toEqual(['open'])
    expect(filterOrders(orders, 'Filled').map((order) => order.id)).toEqual(['filled'])
    expect(filterOrders(orders, 'Cancelled').map((order) => order.id)).toEqual(['cancelled'])
  })
})

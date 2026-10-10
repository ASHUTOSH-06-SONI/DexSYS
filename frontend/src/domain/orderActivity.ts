import type { Order } from '../services/orderService'

export const activityFilters = ['All', 'Open', 'Filled', 'Cancelled'] as const
export type ActivityFilter = typeof activityFilters[number]

export function filterOrders(orders: Order[], filter: ActivityFilter): Order[] {
  if (filter === 'Open') return orders.filter((order) => order.status === 'Pending')
  if (filter === 'Filled' || filter === 'Cancelled') return orders.filter((order) => order.status === filter)
  return orders
}

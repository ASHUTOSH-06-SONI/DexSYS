import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelOrder, createOrder, getOrder, listOrders, type CreateOrder } from './orderService'

const order: CreateOrder = {
  id: 'order-1',
  trading_pair: 'ETH/BTC',
  side: 'Buy',
  order_type: 'Limit',
  price: 0.05,
  quantity: 2,
}

const savedOrder = { ...order, user_id: 'principal-1', status: 'Pending' as const }

describe('orderService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('submits the backend order format and returns the persisted order', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(savedOrder), { status: 200 }))

    await expect(createOrder(order, 'access-token')).resolves.toEqual(savedOrder)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify(order),
    }))
  })

  it('loads persisted order lists and individual orders', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([savedOrder]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(savedOrder), { status: 200 }))

    await expect(listOrders('access-token')).resolves.toEqual([savedOrder])
    await expect(getOrder('order/1', 'access-token')).resolves.toEqual(savedOrder)
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/orders', '/api/orders/order%2F1'])
  })

  it('sends authenticated cancellation requests', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(cancelOrder('order-1', 'access-token')).resolves.toBeUndefined()
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/orders/order-1', expect.objectContaining({
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
    }))
  })

  it('surfaces backend validation and server errors', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid order' }), { status: 400 }))

    await expect(createOrder(order, 'access-token')).rejects.toMatchObject({ message: 'Invalid order', status: 400 })
  })

  it('surfaces backend server failures', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 }))

    await expect(createOrder(order, 'access-token')).rejects.toMatchObject({ message: 'Internal Server Error', status: 500 })
  })

  it('reports API network failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'))

    await expect(createOrder(order, 'access-token')).rejects.toThrow('Unable to reach DexSYS API')
  })

  it('rejects market orders before making an API request', async () => {
    await expect(createOrder({ ...order, order_type: 'Market', price: null }, 'access-token')).rejects.toThrow('Market orders are not supported')
    expect(fetch).not.toHaveBeenCalled()
  })
})

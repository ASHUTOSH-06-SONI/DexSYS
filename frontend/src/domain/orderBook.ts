export type OrderBookLevel = {
  price: string
  quantity: string
}

export type OrderBook = {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
}

export function getDemoOrderBook(pair: string): OrderBook {
  const baseSymbol = pair.split(' / ')[0]

  return {
    bids: [
      { price: '$2,485.50', quantity: `0.80 ${baseSymbol}` },
      { price: '$2,482.00', quantity: `1.20 ${baseSymbol}` },
      { price: '$2,478.90', quantity: `0.95 ${baseSymbol}` },
    ],
    asks: [
      { price: '$2,488.20', quantity: `0.65 ${baseSymbol}` },
      { price: '$2,491.00', quantity: `1.10 ${baseSymbol}` },
      { price: '$2,495.60', quantity: `0.90 ${baseSymbol}` },
    ],
  }
}

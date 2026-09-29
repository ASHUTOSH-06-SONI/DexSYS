export type ValidationState = 'Validated' | 'Pending review' | 'Unsupported'

export type Token = {
  symbol: string
  name: string
  balance: number
  icon: string
  address: string
  price: string
  change: string
  pairs: string[]
  validation: ValidationState
  note: string
}

export type RecentTrade = {
  pair: string
  side: 'Buy' | 'Sell'
  amount: string
  price: string
  status: 'Filled' | 'Pending'
}

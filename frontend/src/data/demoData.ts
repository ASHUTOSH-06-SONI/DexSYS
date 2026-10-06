import type { RecentTrade, Token } from '../types'

export const DEMO_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: 2.48, icon: 'Ξ', address: '0x0000...ETH', price: '$2,486.20', change: '+2.84%', pairs: ['ETH / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Metadata approved for the DexSYS testnet prototype.' },
  { symbol: 'USDC', name: 'USD Coin', balance: 4820.35, icon: '$', address: '0x0000...USDC', price: '$1.00', change: '+0.01%', pairs: ['ETH / USDC', 'WBTC / USDC'], validation: 'Validated', note: 'Stable-value asset approved for the DexSYS testnet prototype.' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.18, icon: '₿', address: '0x0000...WBTC', price: '$64,210.00', change: '+1.17%', pairs: ['WBTC / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Wrapped asset approved for the DexSYS testnet prototype.' },
]

export const DEMO_RECENT_TRADES: RecentTrade[] = [
  { pair: 'ETH / USDC', side: 'Buy', amount: '0.42 ETH', price: '$2,486.20', status: 'Filled' },
  { pair: 'WBTC / USDC', side: 'Sell', amount: '0.03 WBTC', price: '$64,210.00', status: 'Filled' },
  { pair: 'ETH / USDC', side: 'Buy', amount: '0.15 ETH', price: '$2,451.80', status: 'Pending' },
]

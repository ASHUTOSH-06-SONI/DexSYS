import { useMemo, useState } from 'react'
import './App.css'

type Token = {
  symbol: string
  name: string
  balance: number
  icon: string
  address: string
  price: string
  change: string
  pairs: string[]
  validation: 'Validated' | 'Pending review' | 'Unsupported'
  note: string
}

const tokens: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: 2.48, icon: 'Ξ', address: '0x0000...ETH', price: '$2,486.20', change: '+2.84%', pairs: ['ETH / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Metadata approved for the DexSYS testnet prototype.' },
  { symbol: 'USDC', name: 'USD Coin', balance: 4820.35, icon: '$', address: '0x0000...USDC', price: '$1.00', change: '+0.01%', pairs: ['ETH / USDC', 'WBTC / USDC'], validation: 'Validated', note: 'Stable-value asset approved for the DexSYS testnet prototype.' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.18, icon: '₿', address: '0x0000...WBTC', price: '$64,210.00', change: '+1.17%', pairs: ['WBTC / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Wrapped asset approved for the DexSYS testnet prototype.' },
]

const recentTrades = [
  { pair: 'ETH / USDC', side: 'Buy', amount: '0.42 ETH', price: '$2,486.20', status: 'Filled' },
  { pair: 'WBTC / USDC', side: 'Sell', amount: '0.03 WBTC', price: '$64,210.00', status: 'Filled' },
  { pair: 'ETH / USDC', side: 'Buy', amount: '0.15 ETH', price: '$2,451.80', status: 'Pending' },
]

function App() {
  const [fromToken, setFromToken] = useState('ETH')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [connected, setConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'swap' | 'orders'>('swap')
  const [selectedToken, setSelectedToken] = useState('ETH')

  const from = tokens.find((token) => token.symbol === fromToken) ?? tokens[0]
  const to = tokens.find((token) => token.symbol === toToken) ?? tokens[1]
  const token = tokens.find((item) => item.symbol === selectedToken) ?? tokens[0]

  const quote = useMemo(() => {
    const value = Number.parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return '0.00'

    if (from.symbol === 'ETH' && to.symbol === 'USDC') return (value * 2486.2).toFixed(2)
    if (from.symbol === 'USDC' && to.symbol === 'ETH') return (value / 2486.2).toFixed(6)
    if (from.symbol === 'WBTC' && to.symbol === 'USDC') return (value * 64210).toFixed(2)
    if (from.symbol === 'USDC' && to.symbol === 'WBTC') return (value / 64210).toFixed(8)
    return value.toFixed(4)
  }, [amount, from.symbol, to.symbol])

  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setAmount('')
  }

  const maxAmount = () => setAmount(String(from.balance))

  const selectToken = (symbol: string) => {
    setSelectedToken(symbol)
    if (tokens.some((item) => item.symbol === symbol)) setFromToken(symbol)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div><strong>DexSYS</strong><span>Decentralized Exchange</span></div>
        </div>
        <nav className="nav-links" aria-label="Primary navigation">
          <a className="active" href="#trade">Trade</a>
          <a href="#markets">Markets</a>
          <a href="#activity">Activity</a>
        </nav>
        <button className={`wallet-button ${connected ? 'connected' : ''}`} onClick={() => setConnected(!connected)}>
          <span className="status-dot" />{connected ? '0x71...9A2F' : 'Connect Wallet'}
        </button>
      </header>

      <section className="hero-copy" id="trade">
        <div><p className="eyebrow">NON-CUSTODIAL TRADING</p><h1>Trade digital assets with confidence.</h1><p className="subtitle">Simple token swaps with transparent quotes and on-chain settlement.</p></div>
        <div className="network-card"><span>Network</span><strong><i /> DexSYS Testnet</strong></div>
      </section>

      <section className="workspace">
        <div className="trade-card">
          <div className="card-tabs"><button className={activeTab === 'swap' ? 'selected' : ''} onClick={() => setActiveTab('swap')}>Swap</button><button className={activeTab === 'orders' ? 'selected' : ''} onClick={() => setActiveTab('orders')}>Orders</button></div>
          {activeTab === 'swap' ? <>
            <div className="card-heading"><div><h2>Swap tokens</h2><p>Review your quote before submitting.</p></div><span className="fee-pill">0.30% fee</span></div>
            <TokenInput label="You pay" token={from} amount={amount} onAmountChange={setAmount} onTokenChange={selectToken} onMax={maxAmount} disabledToken={to.symbol} />
            <button className="switch-button" aria-label="Switch tokens" onClick={switchTokens}>↓↑</button>
            <TokenInput label="You receive" token={to} amount={quote} onAmountChange={() => undefined} onTokenChange={setToToken} disabledToken={from.symbol} readOnly />
            <div className="quote-details"><span>Rate</span><strong>1 {from.symbol} ≈ {from.symbol === 'ETH' && to.symbol === 'USDC' ? '2,486.20 USDC' : `1 ${to.symbol}`}</strong><span>Price impact</span><strong className="positive">&lt; 0.01%</strong><span>Network fee</span><strong>Estimated</strong></div>
            <button className="primary-action" disabled={!connected || !amount || Number(amount) <= 0}>{!connected ? 'Connect wallet to trade' : 'Review swap'}</button>
          </> : <div className="orders-panel"><div className="card-heading"><div><h2>Recent orders</h2><p>Your latest trading activity.</p></div></div>{recentTrades.map((trade) => <div className="order-row" key={`${trade.pair}-${trade.amount}`}><div><strong>{trade.pair}</strong><span>{trade.side} · {trade.amount}</span></div><div className="order-price"><strong>{trade.price}</strong><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div></div>)}</div>}
        </div>

        <aside className="market-card" id="markets">
          <div className="card-heading"><div><h2>Market overview</h2><p>Indicative prices</p></div><span className="live-pill"><i /> Live</span></div>
          <div className="market-list">{tokens.map((item) => <button className={`market-row ${item.symbol === selectedToken ? 'selected-market' : ''}`} key={item.symbol} onClick={() => selectToken(item.symbol)}><div><span className="token-icon">{item.icon}</span><strong>{item.symbol} / {item.symbol === 'ETH' ? 'USDC' : item.symbol === 'USDC' ? 'USD' : 'USDC'}</strong></div><div><strong>{item.price}</strong><span className="positive">{item.change}</span></div></button>)}</div>
          <div className="balance-card"><span>Portfolio balance</span><strong>{connected ? '$11,084.72' : 'Connect wallet'}</strong><small>{connected ? '+$312.45 (2.90%) today' : 'Connect to view balances'}</small></div>
        </aside>
      </section>

      <section className="token-section" aria-labelledby="token-information-title">
        <div className="section-title"><div><p className="eyebrow">VALIDATED ASSET</p><h2 id="token-information-title">Token information</h2></div><span className="validation-badge">✓ {token.validation}</span></div>
        <div className="token-detail-grid">
          <div className="token-identity"><div className="large-token-icon">{token.icon}</div><div><h3>{token.name}</h3><p>{token.symbol} · Testnet asset</p></div></div>
          <div className="token-stat"><span>Indicative price</span><strong>{token.price}</strong><small className="positive">{token.change} 24h</small></div>
          <div className="token-stat"><span>Wallet balance</span><strong>{connected ? `${token.balance.toLocaleString()} ${token.symbol}` : '—'}</strong><small>{connected ? 'Connected wallet' : 'Connect wallet to view'}</small></div>
          <div className="token-address"><span>Contract / identifier</span><code>{token.address}</code><small>Representative testnet identifier</small></div>
        </div>
        <div className="token-bottom"><div><span className="detail-label">Supported pairs</span><div className="pair-list">{token.pairs.map((pair) => <button key={pair} onClick={() => setSelectedToken(pair.split(' / ')[0])}>{pair}</button>)}</div></div><div className="validation-note"><strong>Validation note</strong><p>{token.note}</p></div></div>
      </section>

      <section className="activity-section" id="activity">
        <div className="section-title"><div><p className="eyebrow">ACTIVITY</p><h2>Recent trades</h2></div><button className="text-button">View all →</button></div>
        <div className="activity-table"><div className="table-head"><span>Pair</span><span>Side</span><span>Amount</span><span>Price</span><span>Status</span></div>{recentTrades.map((trade) => <div className="table-row" key={`${trade.pair}-${trade.price}`}><strong>{trade.pair}</strong><span>{trade.side}</span><span>{trade.amount}</span><span>{trade.price}</span><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>)}</div>
      </section>
      <footer><span>DexSYS</span><span>Testnet environment · Quotes and token metadata are indicative</span></footer>
    </main>
  )
}

function TokenInput({ label, token, amount, onAmountChange, onTokenChange, onMax, disabledToken, readOnly = false }: { label: string; token: Token; amount: string; onAmountChange: (value: string) => void; onTokenChange: (value: string) => void; onMax?: () => void; disabledToken: string; readOnly?: boolean }) {
  return <div className="token-input"><div className="input-label"><span>{label}</span><span>Balance: {token.balance.toLocaleString()}</span></div><div className="input-row"><input aria-label={`${label} amount`} value={amount} placeholder="0.00" onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.]/g, ''))} readOnly={readOnly} /><select value={token.symbol} onChange={(event) => onTokenChange(event.target.value)} aria-label={`${label} token`}>{tokens.filter((item) => item.symbol !== disabledToken).map((item) => <option value={item.symbol} key={item.symbol}>{item.icon} {item.symbol}</option>)}</select></div>{!readOnly && <button className="max-button" onClick={onMax}>MAX</button>}</div>
}

export default App

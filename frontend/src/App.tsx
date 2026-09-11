import { useMemo, useState } from 'react'
import './App.css'

type Token = {
  symbol: string
  name: string
  balance: number
  icon: string
}

const tokens: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: 2.48, icon: 'Ξ' },
  { symbol: 'USDC', name: 'USD Coin', balance: 4820.35, icon: '$' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.18, icon: '₿' },
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

  const from = tokens.find((token) => token.symbol === fromToken) ?? tokens[0]
  const to = tokens.find((token) => token.symbol === toToken) ?? tokens[1]

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>DexSYS</strong>
            <span>Decentralized Exchange</span>
          </div>
        </div>
        <nav className="nav-links" aria-label="Primary navigation">
          <a className="active" href="#trade">Trade</a>
          <a href="#markets">Markets</a>
          <a href="#activity">Activity</a>
        </nav>
        <button className={`wallet-button ${connected ? 'connected' : ''}`} onClick={() => setConnected(!connected)}>
          <span className="status-dot" />
          {connected ? '0x71...9A2F' : 'Connect Wallet'}
        </button>
      </header>

      <section className="hero-copy" id="trade">
        <div>
          <p className="eyebrow">NON-CUSTODIAL TRADING</p>
          <h1>Trade digital assets with confidence.</h1>
          <p className="subtitle">Simple token swaps with transparent quotes and on-chain settlement.</p>
        </div>
        <div className="network-card">
          <span>Network</span>
          <strong><i /> DexSYS Testnet</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="trade-card">
          <div className="card-tabs">
            <button className={activeTab === 'swap' ? 'selected' : ''} onClick={() => setActiveTab('swap')}>Swap</button>
            <button className={activeTab === 'orders' ? 'selected' : ''} onClick={() => setActiveTab('orders')}>Orders</button>
          </div>

          {activeTab === 'swap' ? (
            <>
              <div className="card-heading">
                <div>
                  <h2>Swap tokens</h2>
                  <p>Review your quote before submitting.</p>
                </div>
                <span className="fee-pill">0.30% fee</span>
              </div>

              <TokenInput
                label="You pay"
                token={from}
                amount={amount}
                onAmountChange={setAmount}
                onTokenChange={setFromToken}
                onMax={maxAmount}
                disabledToken={to.symbol}
              />

              <button className="switch-button" aria-label="Switch tokens" onClick={switchTokens}>↓↑</button>

              <TokenInput
                label="You receive"
                token={to}
                amount={quote}
                onAmountChange={() => undefined}
                onTokenChange={setToToken}
                disabledToken={from.symbol}
                readOnly
              />

              <div className="quote-details">
                <span>Rate</span><strong>1 {from.symbol} ≈ {from.symbol === 'ETH' && to.symbol === 'USDC' ? '2,486.20 USDC' : `1 ${to.symbol}`}</strong>
                <span>Price impact</span><strong className="positive">&lt; 0.01%</strong>
                <span>Network fee</span><strong>Estimated</strong>
              </div>

              <button className="primary-action" disabled={!connected || !amount || Number(amount) <= 0}>
                {!connected ? 'Connect wallet to trade' : 'Review swap'}
              </button>
            </>
          ) : (
            <div className="orders-panel">
              <div className="card-heading">
                <div><h2>Recent orders</h2><p>Your latest trading activity.</p></div>
              </div>
              {recentTrades.map((trade) => (
                <div className="order-row" key={`${trade.pair}-${trade.amount}`}>
                  <div><strong>{trade.pair}</strong><span>{trade.side} · {trade.amount}</span></div>
                  <div className="order-price"><strong>{trade.price}</strong><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="market-card" id="markets">
          <div className="card-heading">
            <div><h2>Market overview</h2><p>Indicative prices</p></div>
            <span className="live-pill"><i /> Live</span>
          </div>
          <div className="market-list">
            <MarketRow pair="ETH / USDC" price="$2,486.20" change="+2.84%" />
            <MarketRow pair="WBTC / USDC" price="$64,210.00" change="+1.17%" />
            <MarketRow pair="ETH / WBTC" price="0.03872" change="-0.42%" negative />
          </div>
          <div className="balance-card">
            <span>Portfolio balance</span>
            <strong>{connected ? '$11,084.72' : 'Connect wallet'}</strong>
            <small>{connected ? '+$312.45 (2.90%) today' : 'Connect to view balances'}</small>
          </div>
        </aside>
      </section>

      <section className="activity-section" id="activity">
        <div className="section-title"><div><p className="eyebrow">ACTIVITY</p><h2>Recent trades</h2></div><button className="text-button">View all →</button></div>
        <div className="activity-table">
          <div className="table-head"><span>Pair</span><span>Side</span><span>Amount</span><span>Price</span><span>Status</span></div>
          {recentTrades.map((trade) => <div className="table-row" key={`${trade.pair}-${trade.price}`}><strong>{trade.pair}</strong><span>{trade.side}</span><span>{trade.amount}</span><span>{trade.price}</span><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>)}
        </div>
      </section>

      <footer><span>DexSYS</span><span>Testnet environment · Quotes are indicative</span></footer>
    </main>
  )
}

function TokenInput({ label, token, amount, onAmountChange, onTokenChange, onMax, disabledToken, readOnly = false }: { label: string; token: Token; amount: string; onAmountChange: (value: string) => void; onTokenChange: (value: string) => void; onMax?: () => void; disabledToken: string; readOnly?: boolean }) {
  return (
    <div className="token-input">
      <div className="input-label"><span>{label}</span><span>Balance: {token.balance.toLocaleString()}</span></div>
      <div className="input-row">
        <input aria-label={`${label} amount`} value={amount} placeholder="0.00" onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.]/g, ''))} readOnly={readOnly} />
        <select value={token.symbol} onChange={(event) => onTokenChange(event.target.value)} aria-label={`${label} token`}>
          {tokens.filter((item) => item.symbol !== disabledToken).map((item) => <option value={item.symbol} key={item.symbol}>{item.icon} {item.symbol}</option>)}
        </select>
      </div>
      {!readOnly && <button className="max-button" onClick={onMax}>MAX</button>}
    </div>
  )
}

function MarketRow({ pair, price, change, negative = false }: { pair: string; price: string; change: string; negative?: boolean }) {
  return <div className="market-row"><div><span className="token-icon">{pair.split('')[0]}</span><strong>{pair}</strong></div><div><strong>{price}</strong><span className={negative ? 'negative' : 'positive'}>{change}</span></div></div>
}

export default App

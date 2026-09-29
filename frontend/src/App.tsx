import { useMemo, useState } from 'react'
import './App.css'

type Token = {
  symbol: string
  name: string
  balance: number
  icon: string
  address: string
  price: number
  change: number
  volume: string
  pairs: string[]
  validation: 'Validated' | 'Pending review' | 'Unsupported'
  note: string
}

const tokens: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: 2.48, icon: 'Ξ', address: '0x0000...ETH', price: 2486.2, change: 2.84, volume: '$184.2M', pairs: ['ETH / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Metadata approved for the DexSYS testnet prototype.' },
  { symbol: 'USDC', name: 'USD Coin', balance: 4820.35, icon: '$', address: '0x0000...USDC', price: 1, change: 0.01, volume: '$92.8M', pairs: ['ETH / USDC', 'WBTC / USDC'], validation: 'Validated', note: 'Stable-value asset approved for the DexSYS testnet prototype.' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.18, icon: '₿', address: '0x0000...WBTC', price: 64210, change: 1.17, volume: '$61.4M', pairs: ['WBTC / USDC', 'ETH / WBTC'], validation: 'Validated', note: 'Wrapped asset approved for the DexSYS testnet prototype.' },
]

const recentTrades = [
  { time: '09:31:42', pair: 'ETH / USDC', side: 'Buy', amount: '0.42 ETH', price: '$2,486.20', status: 'Filled' },
  { time: '09:28:17', pair: 'WBTC / USDC', side: 'Sell', amount: '0.03 WBTC', price: '$64,210.00', status: 'Filled' },
  { time: '09:22:04', pair: 'ETH / USDC', side: 'Buy', amount: '0.15 ETH', price: '$2,451.80', status: 'Pending' },
  { time: '09:18:39', pair: 'ETH / USDC', side: 'Sell', amount: '0.27 ETH', price: '$2,472.10', status: 'Filled' },
]

const asks = [
  ['2,493.80', '0.42'], ['2,492.60', '0.18'], ['2,491.20', '0.31'], ['2,489.90', '0.24'], ['2,488.70', '0.57'],
]
const bids = [
  ['2,484.20', '0.26'], ['2,483.10', '0.44'], ['2,481.80', '0.19'], ['2,479.60', '0.63'], ['2,477.90', '0.35'],
]

const chartPoints = '0,170 28,156 56,161 84,139 112,145 140,120 168,128 196,111 224,116 252,88 280,97 308,71 336,79 364,55 392,61 420,42 448,48 476,27 504,36 532,18 560,30 588,9 616,20 644,5'

function App() {
  const [fromToken, setFromToken] = useState('ETH')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [connected, setConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'swap' | 'orders'>('swap')
  const [selectedToken, setSelectedToken] = useState('ETH')
  const [dark, setDark] = useState(() => localStorage.getItem('dexsys-theme') === 'dark')
  const [timeframe, setTimeframe] = useState('1H')
  const [marketFilter, setMarketFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

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

  const filteredTokens = tokens.filter((item) =>
    item.symbol.toLowerCase().includes(marketFilter.toLowerCase()) ||
    item.name.toLowerCase().includes(marketFilter.toLowerCase())
  )

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('dexsys-theme', next ? 'dark' : 'light')
  }

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
    <main className={`app-shell ${dark ? 'dark' : ''}`}>
      <div className="announcement"><span className="announcement-dot" /> DexSYS Testnet · Matching engine online · Quotes are indicative <span className="announcement-link">View status →</span></div>

      <header className="topbar">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark">D</span>
          <span><strong>DexSYS</strong><small>DECENTRALIZED EXCHANGE</small></span>
        </button>
        <nav className={`nav-links ${mobileMenu ? 'open' : ''}`} aria-label="Primary navigation">
          <a className="active" href="#trade">Trade</a>
          <a href="#markets">Markets</a>
          <a href="#activity">Activity</a>
          <a href="#protocol">Protocol</a>
        </nav>
        <div className="top-actions">
          <button className="icon-button" onClick={toggleTheme} aria-label="Toggle colour theme">{dark ? '☼' : '◐'}</button>
          <button className={`wallet-button ${connected ? 'connected' : ''}`} onClick={() => setConnected(!connected)}>
            <span className="status-dot" />{connected ? '0x71...9A2F' : 'Connect wallet'}
          </button>
          <button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu">☰</button>
        </div>
      </header>

      <section className="hero-copy" id="trade">
        <div>
          <p className="eyebrow">NON-CUSTODIAL · ON-CHAIN</p>
          <h1>Markets, without the middleman.</h1>
          <p className="subtitle">A focused trading interface for the DexSYS matching engine — transparent quotes, visible liquidity, and self-custody by design.</p>
          <div className="hero-actions"><a href="#terminal" className="primary-link">Start trading <span>↗</span></a><a href="#protocol" className="secondary-link">Explore protocol</a></div>
        </div>
        <div className="network-card"><span>NETWORK</span><strong><i /> DexSYS Testnet</strong><small>Chain ID 31337 · Connected</small></div>
      </section>

      <section className="ticker-strip" aria-label="Market ticker">
        {tokens.map((item) => <button key={item.symbol} onClick={() => selectToken(item.symbol)}><span>{item.symbol}</span><strong>${item.price.toLocaleString(undefined, { minimumFractionDigits: item.price < 10 ? 2 : 2, maximumFractionDigits: 2 })}</strong><em className={item.change >= 0 ? 'positive' : 'negative'}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</em></button>)}
        <div className="ticker-more">24H VOLUME <strong>$338.4M</strong></div>
      </section>

      <section className="terminal" id="terminal">
        <div className="terminal-main">
          <div className="market-header">
            <div className="pair-heading"><span className="pair-icon">{token.icon}</span><div><div className="pair-name">{token.symbol}<span>/ USDC</span></div><small>DexSYS Testnet · Spot</small></div></div>
            <div className="price-block"><strong>${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="positive">+{token.change.toFixed(2)}%</span></div>
            <div className="market-stats"><span>24h high <b>$2,517.90</b></span><span>24h low <b>$2,401.30</b></span><span>Volume <b>{token.volume}</b></span></div>
          </div>

          <div className="chart-toolbar">
            <div className="chart-tabs"><button className="active">Chart</button><button>Depth</button><button>Info</button></div>
            <div className="timeframes">{['5M', '15M', '1H', '4H', '1D', '1W'].map((item) => <button key={item} className={timeframe === item ? 'active' : ''} onClick={() => setTimeframe(item)}>{item}</button>)}</div>
          </div>

          <div className="chart">
            <div className="chart-grid"><span>2,520</span><span>2,500</span><span>2,480</span><span>2,460</span><span>2,440</span></div>
            <svg viewBox="0 0 644 190" preserveAspectRatio="none" aria-label="Indicative price chart">
              <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopOpacity=".22" /><stop offset="1" stopOpacity="0" /></linearGradient></defs>
              <polyline className="chart-area" points={`0,190 ${chartPoints} 644,190`} />
              <polyline className="chart-line" points={chartPoints} />
            </svg>
            <div className="chart-cross"><span>09:30</span><b>2,486.20</b></div>
          </div>

          <div className="orderbook">
            <div className="subhead"><h3>Order book</h3><span>Price (USDC) · Amount (ETH)</span></div>
            <div className="book-columns"><span>Price</span><span>Amount</span><span>Total</span></div>
            <div className="book-rows">{asks.map(([price, amount]) => <div className="book-row ask" key={price}><span>{price}</span><span>{amount}</span><span>{(Number(price.replace(',', '')) * Number(amount)).toFixed(2)}</span></div>)}</div>
            <div className="mid-price"><strong>2,486.20</strong><span>≈ $2,486.20</span></div>
            <div className="book-rows">{bids.map(([price, amount]) => <div className="book-row bid" key={price}><span>{price}</span><span>{amount}</span><span>{(Number(price.replace(',', '')) * Number(amount)).toFixed(2)}</span></div>)}</div>
          </div>
        </div>

        <aside className="trade-panel">
          <div className="panel-tabs"><button className={activeTab === 'swap' ? 'active' : ''} onClick={() => setActiveTab('swap')}>Swap</button><button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>Orders</button></div>
          {activeTab === 'swap' ? <div className="swap-panel">
            <div className="panel-title"><div><h2>Swap</h2><p>Trade directly from your wallet.</p></div><span>0.30%</span></div>
            <TokenInput label="You pay" token={from} amount={amount} onAmountChange={setAmount} onTokenChange={setFromToken} onMax={maxAmount} disabledToken={to.symbol} />
            <button className="switch-button" aria-label="Switch tokens" onClick={switchTokens}>↕</button>
            <TokenInput label="You receive" token={to} amount={quote} onAmountChange={() => undefined} onTokenChange={setToToken} disabledToken={from.symbol} readOnly />
            <div className="quote-details"><span>Rate</span><strong>1 {from.symbol} ≈ {from.symbol === 'ETH' && to.symbol === 'USDC' ? '2,486.20 USDC' : `1 ${to.symbol}`}</strong><span>Price impact</span><strong className="positive">&lt; 0.01%</strong><span>Network fee</span><strong>Estimated</strong></div>
            <button className="primary-action" disabled={!connected || !amount || Number(amount) <= 0} onClick={() => setShowModal(true)}>{!connected ? 'Connect wallet to trade' : 'Review swap'}</button>
            <p className="panel-footnote"><span>◈</span> Non-custodial · You approve every transaction</p>
          </div> : <div className="orders-panel"><div className="panel-title"><div><h2>Orders</h2><p>Recent activity on DexSYS.</p></div></div>{recentTrades.slice(0, 3).map((trade) => <div className="order-row" key={`${trade.time}-${trade.pair}`}><div><strong>{trade.pair}</strong><span>{trade.side} · {trade.amount}</span></div><div className="order-price"><strong>{trade.price}</strong><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div></div>)}</div>}
        </aside>
      </section>

      <section className="markets-section" id="markets">
        <div className="section-heading"><div><p className="eyebrow">MARKETS</p><h2>Explore assets</h2></div><div className="market-tools"><input value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} placeholder="Search assets" /><button className="filter-active">All</button><button>Top movers</button></div></div>
        <div className="market-table">
          <div className="market-head"><span>Asset</span><span>Price</span><span>24h change</span><span>24h volume</span><span>Action</span></div>
          {filteredTokens.map((item) => <button className={`market-table-row ${item.symbol === selectedToken ? 'selected-market' : ''}`} key={item.symbol} onClick={() => selectToken(item.symbol)}><span className="asset-cell"><i>{item.icon}</i><b>{item.name}</b><small>{item.symbol}</small></span><strong>${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="positive">+{item.change.toFixed(2)}%</span><span>{item.volume}</span><span className="trade-arrow">Trade ↗</span></button>)}
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div><p className="eyebrow">BUILT FOR TRANSPARENCY</p><h2>Trading infrastructure,<br /><span>without the black box.</span></h2></div>
        <div className="protocol-grid">
          <article><span>01</span><h3>Self-custody</h3><p>Your assets stay in your wallet. DexSYS only routes the intent and settlement.</p></article>
          <article><span>02</span><h3>Visible liquidity</h3><p>Inspect indicative prices, depth and recent activity before you review a trade.</p></article>
          <article><span>03</span><h3>Composable protocol</h3><p>Rust services, typed APIs and on-chain contracts form a modular execution stack.</p></article>
        </div>
      </section>

      <section className="activity-section" id="activity">
        <div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent trades</h2></div><button className="text-button">View all →</button></div>
        <div className="activity-table"><div className="table-head"><span>Time</span><span>Pair</span><span>Side</span><span>Amount</span><span>Price</span><span>Status</span></div>{recentTrades.map((trade) => <div className="table-row" key={trade.time}><span>{trade.time}</span><strong>{trade.pair}</strong><span>{trade.side}</span><span>{trade.amount}</span><span>{trade.price}</span><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>)}</div>
      </section>

      <section className="token-section" aria-labelledby="token-information-title">
        <div className="section-heading"><div><p className="eyebrow">ASSET REGISTRY</p><h2 id="token-information-title">Token information</h2></div><span className="validation-badge">✓ {token.validation}</span></div>
        <div className="token-detail-grid">
          <div className="token-identity"><div className="large-token-icon">{token.icon}</div><div><h3>{token.name}</h3><p>{token.symbol} · Testnet asset</p></div></div>
          <div className="token-stat"><span>Indicative price</span><strong>${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small className="positive">+{token.change.toFixed(2)}% 24h</small></div>
          <div className="token-stat"><span>Wallet balance</span><strong>{connected ? `${token.balance.toLocaleString()} ${token.symbol}` : '—'}</strong><small>{connected ? 'Connected wallet' : 'Connect wallet to view'}</small></div>
          <div className="token-address"><span>Contract / identifier</span><code>{token.address}</code><small>Representative testnet identifier</small></div>
        </div>
        <div className="token-bottom"><div><span className="detail-label">Supported pairs</span><div className="pair-list">{token.pairs.map((pair) => <button key={pair} onClick={() => setSelectedToken(pair.split(' / ')[0])}>{pair}</button>)}</div></div><div className="validation-note"><strong>Validation note</strong><p>{token.note}</p></div></div>
      </section>

      <footer id="footer"><div><strong>DexSYS</strong><span>Decentralized exchange infrastructure</span></div><div><span>Testnet environment</span><span>Quotes and token metadata are indicative</span></div></footer>

      {showModal && <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}><div className="review-modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowModal(false)}>×</button><p className="eyebrow">TRANSACTION PREVIEW</p><h2>Review swap</h2><p className="modal-copy">Confirm the quote before handing the transaction to your wallet.</p><div className="review-route"><div><span>Pay</span><strong>{amount || '0'} {from.symbol}</strong></div><span className="route-arrow">→</span><div><span>Receive</span><strong>{quote} {to.symbol}</strong></div></div><div className="review-lines"><span>Rate <b>1 {from.symbol} ≈ {from.symbol === 'ETH' ? '2,486.20 USDC' : '1 ' + to.symbol}</b></span><span>Network <b>DexSYS Testnet</b></span><span>Settlement <b>On-chain</b></span></div><div className="modal-warning">Wallet and transaction submission are not integrated yet. This is a UI-only review step.</div><button className="primary-action" onClick={() => setShowModal(false)}>Close preview</button></div></div>}
    </main>
  )
}

function TokenInput({ label, token, amount, onAmountChange, onTokenChange, onMax, disabledToken, readOnly = false }: { label: string; token: Token; amount: string; onAmountChange: (value: string) => void; onTokenChange: (value: string) => void; onMax?: () => void; disabledToken: string; readOnly?: boolean }) {
  return <div className="token-input"><div className="input-label"><span>{label}</span><span>Balance: {token.balance.toLocaleString()}</span></div><div className="input-row"><input aria-label={`${label} amount`} value={amount} placeholder="0.00" onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.]/g, ''))} readOnly={readOnly} /><select value={token.symbol} onChange={(event) => onTokenChange(event.target.value)} aria-label={`${label} token`}>{tokens.filter((item) => item.symbol !== disabledToken).map((item) => <option value={item.symbol} key={item.symbol}>{item.icon} {item.symbol}</option>)}</select></div>{!readOnly && <button className="max-button" onClick={onMax}>MAX</button>}</div>
}

export default App

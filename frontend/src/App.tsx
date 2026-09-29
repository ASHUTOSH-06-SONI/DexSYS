import { useEffect, useState } from 'react'
import { DEMO_RECENT_TRADES, DEMO_TOKENS } from './data/demoData'
import { getVisibleMarkets, selectMarketToken } from './domain/marketSelection'
import { calculateSwapQuote } from './domain/swapQuote'
import { getMaxAmount, reverseTokenPair } from './domain/swapState'
import { loadThemePreference, saveThemePreference } from './domain/themePreference'
import { getMarketTokens } from './services/tokenService'
import TokenInput from './components/TokenInput'
import type { Token } from './types'
import './App.css'

const timeframes = ['1H', '24H', '1W', '1M', '1Y', 'ALL']
const changeTone = (change: string) => change.startsWith('-') ? 'negative' : 'positive'

function App() {
  const [fromToken, setFromToken] = useState('ETH')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [activeTab, setActiveTab] = useState<'swap' | 'orders'>('swap')
  const [selectedToken, setSelectedToken] = useState('ETH')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadThemePreference(window.localStorage))
  const [timeframe, setTimeframe] = useState('24H')
  const [marketFilter, setMarketFilter] = useState<'all' | 'movers'>('all')
  const [marketSearch, setMarketSearch] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [apiTokens, setApiTokens] = useState<Token[] | null>(null)
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'offline'>('loading')
  const [apiError, setApiError] = useState('')
  const [retryTokenLoad, setRetryTokenLoad] = useState(0)
  const tokens = apiTokens ?? DEMO_TOKENS

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveThemePreference(window.localStorage, theme)
  }, [theme])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReviewOpen(false)
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getMarketTokens(controller.signal).then((loadedTokens) => {
      if (controller.signal.aborted) return
      setApiTokens(loadedTokens)
      setApiStatus('connected')
      setSelectedToken(loadedTokens[0].symbol)
      setFromToken(loadedTokens[0].symbol)
      const receiveToken = loadedTokens.find((item) => item.symbol !== loadedTokens[0].symbol)
      if (receiveToken) setToToken(receiveToken.symbol)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setApiTokens(null)
      setApiStatus('offline')
      setApiError(error instanceof Error ? error.message : 'The token service is unavailable.')
      setSelectedToken('ETH')
      setFromToken('ETH')
      setToToken('USDC')
    })

    return () => controller.abort()
  }, [retryTokenLoad])

  const from = tokens.find((item) => item.symbol === fromToken) ?? tokens[0]
  const to = tokens.find((item) => item.symbol === toToken) ?? tokens.find((item) => item.symbol !== from.symbol) ?? tokens[0]
  const token = tokens.find((item) => item.symbol === selectedToken) ?? tokens[0]
  const visibleMarkets = getVisibleMarkets(tokens, marketSearch, marketFilter)

  const quote = calculateSwapQuote(amount, from, to)

  const switchTokens = () => {
    const reversedPair = reverseTokenPair({ fromToken, toToken })
    setFromToken(reversedPair.fromToken)
    setToToken(reversedPair.toToken)
    setAmount('')
  }

  const maxAmount = () => setAmount(getMaxAmount(from.balance))

  const selectToken = (symbol: string) => {
    const selection = selectMarketToken(symbol, fromToken, toToken, tokens)
    setSelectedToken(selection.selectedToken)
    setFromToken(selection.fromToken)
    setToToken(selection.toToken)
  }

  const confirmSwap = () => {
    setReviewOpen(false)
    setNotice('Preview only · transaction submission is not connected')
    window.setTimeout(() => setNotice(''), 4200)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#trade" aria-label="DexSYS home"><span className="brand-mark">D</span><span className="brand-name">Dex<span>SYS</span></span></a>
        <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`} id="primary-navigation" aria-label="Primary navigation">
          <a className="active" href="#trade" onClick={() => setMobileMenuOpen(false)}>Exchange</a>
          <a href="#markets" onClick={() => setMobileMenuOpen(false)}>Markets</a>
          <a href="#portfolio" onClick={() => setMobileMenuOpen(false)}>Portfolio</a>
          <a href="#activity" onClick={() => setMobileMenuOpen(false)}>Activity</a>
        </nav>
        <div className="topbar-actions">
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '◐' : '☼'}</button>
          <button className="wallet-button" type="button" disabled title="Wallet integration is not available yet"><span className="status-dot" />Wallet pending</button>
          <button className="menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="primary-navigation" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? '×' : '☰'}</button>
        </div>
      </header>

      <div className={`backend-status ${apiStatus}`} role="status" aria-live="polite">
        <span className="backend-status-message">{apiStatus === 'loading' ? 'Loading token data · representative demo values shown' : apiStatus === 'connected' ? 'DexSYS token API connected · backend values are currently seeded' : 'Token API unavailable · representative demo data shown'}</span>
        {apiError && <span className="backend-status-error" title={apiError}>{apiError}</span>}
        {apiStatus === 'offline' && <button type="button" onClick={() => { setApiStatus('loading'); setApiError(''); setRetryTokenLoad((attempt) => attempt + 1) }}>Retry</button>}
      </div>
      <div className="market-tape"><span className="tape-label"><i /> TESTNET MARKETS</span>{tokens.map((item) => <span className="tape-item" key={item.symbol}><b>{item.symbol}/{item.symbol === 'USDC' ? 'USD' : 'USDC'}</b><strong>{item.price}</strong><em className={changeTone(item.change)}>{item.change}</em></span>)}<span className="tape-disclaimer">Indicative prices</span></div>

      <div className="page-content" id="trade">
        <section className="instrument-heading"><div className="instrument-title"><span className="asset-symbol">{token.icon}</span><div><div className="pair-name">{token.symbol}<span>/</span>{token.symbol === 'USDC' ? 'USD' : 'USDC'} <span className="pair-caret">⌄</span></div><span className="instrument-caption">{token.name} · DexSYS Testnet</span></div></div><div className="instrument-price"><strong>{token.price}</strong><span className={changeTone(token.change)}>{token.change} <small>24h</small></span></div><div className="network-card"><span>Network</span><strong><i /> DexSYS Testnet</strong></div></section>

        <section className="workspace">
          <div className="market-workspace">
            <section className="chart-panel" aria-labelledby="chart-title">
              <div className="chart-toolbar"><div className="chart-tabs"><button className="chart-tab active" id="chart-title">Chart</button><button className="chart-tab" onClick={() => document.getElementById('markets')?.scrollIntoView({ behavior: 'smooth' })}>Market data</button></div><div className="timeframes" aria-label="Chart timeframe">{timeframes.map((period) => <button key={period} className={period === timeframe ? 'selected' : ''} onClick={() => setTimeframe(period)}>{period}</button>)}</div></div>
              <div className="chart-summary"><div><span>Price · {timeframe}</span><strong>{token.price}</strong></div><span className={`chart-change ${changeTone(token.change)}`}>↗ {token.change}</span></div>
              <div className="chart-wrap"><svg className="price-chart" viewBox="0 0 920 300" preserveAspectRatio="none" role="img" aria-label={`${token.symbol} indicative price chart, rising over ${timeframe}`}><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--chart)" stopOpacity="0" /></linearGradient></defs><path className="chart-area" d="M0 222 C28 213 42 221 62 198 S102 205 127 186 157 192 178 164 206 184 229 156 264 168 289 144 323 168 348 135 377 146 402 121 435 140 458 117 485 125 510 104 540 129 565 94 594 111 623 78 652 105 678 81 706 94 734 66 760 84 791 50 820 68 850 43 880 56 920 28 L920 300 L0 300 Z" /><path className="chart-line" d="M0 222 C28 213 42 221 62 198 S102 205 127 186 157 192 178 164 206 184 229 156 264 168 289 144 323 168 348 135 377 146 402 121 435 140 458 117 485 125 510 104 540 129 565 94 594 111 623 78 652 105 678 81 706 94 734 66 760 84 791 50 820 68 850 43 880 56 920 28" /><line className="chart-crosshair" x1="0" y1="97" x2="920" y2="97" /><circle className="chart-point" cx="920" cy="28" r="5" /><text x="8" y="292">09:00</text><text x="230" y="292">13:00</text><text x="460" y="292">17:00</text><text x="690" y="292">21:00</text><text x="875" y="292">NOW</text></svg><div className="chart-axis"><span>{token.price}</span><span>{token.price}</span><span>{token.price}</span><span>{token.price}</span></div><div className="volume-bars" aria-hidden="true">{[23, 36, 27, 50, 32, 44, 62, 35, 55, 40, 70, 46, 60, 37, 76, 54, 42, 68, 48, 82, 57, 73, 51, 65, 43, 76, 58, 90, 62, 48, 74, 55, 84, 61, 70, 52, 93, 66, 80, 59].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div>
              <div className="chart-footer"><span>DexSYS Testnet · {token.symbol}/{token.symbol === 'USDC' ? 'USD' : 'USDC'}</span><span><i /> Illustrative chart · history API pending</span></div>
            </section>

            <section className="market-table-panel" id="markets"><div className="section-heading market-heading"><div><p className="eyebrow">MARKETS</p><h2>Spot markets</h2></div><label className="market-search"><span>⌕</span><input aria-label="Search assets" placeholder="Search assets" value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} /></label></div><div className="market-controls"><div className="segmented-control"><button className={marketFilter === 'all' ? 'selected' : ''} onClick={() => setMarketFilter('all')}>All assets</button><button className={marketFilter === 'movers' ? 'selected' : ''} onClick={() => setMarketFilter('movers')}>Top movers</button></div><span>Indicative · USD</span></div><div className="asset-table"><div className="asset-table-head"><span>Asset / pair</span><span>Last price</span><span>24h change</span><span>{apiStatus === 'connected' ? 'API seed' : 'Demo / seed'}</span></div>{visibleMarkets.map((item) => <button className={`asset-row ${item.symbol === selectedToken ? 'is-active' : ''}`} key={item.symbol} onClick={() => selectToken(item.symbol)}><span className="asset-name"><i className={`coin coin-${item.symbol.toLowerCase()}`}>{item.icon}</i><span><strong>{item.name}</strong><small>{item.symbol} / {item.symbol === 'USDC' ? 'USD' : 'USDC'}</small></span></span><strong>{item.price}</strong><span className={changeTone(item.change)}>{item.change}</span><span className="asset-balance">{apiStatus === 'connected' ? 'API seed ' : 'Demo seed '}{item.balance.toLocaleString()} {item.symbol}</span></button>)}{visibleMarkets.length === 0 && <p className="empty-state">No supported assets match your search.</p>}</div><p className="table-footnote">Prices and seed amounts are indicative only; no wallet balance is connected.</p></section>
          </div>

          <aside className="trade-panel" aria-label="Trade panel"><div className="trade-panel-top"><div className="trade-tabs"><button className={activeTab === 'swap' ? 'selected' : ''} onClick={() => setActiveTab('swap')}>Swap</button><button className={activeTab === 'orders' ? 'selected' : ''} onClick={() => setActiveTab('orders')}>Orders</button></div><span className="settings-summary" title="Slippage tolerance">0.50% slippage</span></div>
            {activeTab === 'swap' ? <><div className="trade-title"><div><h2>Swap preview</h2><p>Frontend quote · not an order</p></div><span className="fee-pill">0.30% indicative fee</span></div><TokenInput label="You pay" token={from} amount={amount} tokens={tokens} balanceLabel={apiStatus === 'connected' ? 'API seed' : 'Demo / seed'} onAmountChange={setAmount} onTokenChange={selectToken} onMax={maxAmount} disabledToken={to.symbol} /><button className="switch-button" aria-label="Switch tokens" onClick={switchTokens}>↕</button><TokenInput label="You receive" token={to} amount={quote} tokens={tokens} balanceLabel={apiStatus === 'connected' ? 'API seed' : 'Demo / seed'} onAmountChange={() => undefined} onTokenChange={setToToken} disabledToken={from.symbol} readOnly /><div className="quote-details"><div><span>Indicative rate</span><strong>1 {from.symbol} ≈ {calculateSwapQuote('1', from, to)} {to.symbol}</strong></div><div><span>Price impact</span><strong>Unavailable</strong></div><div><span>Network fee</span><strong>Not connected</strong></div><div><span>Route</span><strong>{from.symbol} → {to.symbol}</strong></div></div><button className="primary-action" disabled={!amount || Number(amount) <= 0} onClick={() => setReviewOpen(true)}>{!amount ? 'Enter an amount' : 'Review quote preview'}</button><p className="prototype-note">This local estimate is not an order or blockchain transaction.</p></> : <div className="orders-panel"><div className="trade-title"><div><h2>Sample orders</h2><p>Prototype history · backend orders not connected</p></div></div>{DEMO_RECENT_TRADES.map((trade) => <div className="order-row" key={`${trade.pair}-${trade.amount}`}><div><strong>{trade.pair}</strong><span>{trade.side} · {trade.amount}</span></div><div className="order-price"><strong>{trade.price}</strong><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div></div>)}</div>}
          </aside>
        </section>

      <section className="portfolio-summary" id="portfolio" aria-labelledby="portfolio-title">
        <div className="portfolio-total"><p className="eyebrow">YOUR ACCOUNT</p><h2 id="portfolio-title">Portfolio overview</h2><span>Total balance</span><strong>—</strong><small>Wallet integration pending</small></div>
        <div className="portfolio-assets">{tokens.map((item) => <div className="portfolio-asset" key={item.symbol}><span className={`coin coin-${item.symbol.toLowerCase()}`}>{item.icon}</span><span><strong>{item.name}</strong><small>{item.symbol}</small></span><span className="portfolio-asset-balance">—<small>{item.price}</small></span></div>)}</div>
      </section>

      <section className="token-section" id="token-information" aria-labelledby="token-information-title">
        <div className="section-title"><div><p className="eyebrow">VALIDATED ASSET</p><h2 id="token-information-title">Token information</h2></div><span className="validation-badge">✓ {token.validation}</span></div>
        <div className="token-detail-grid">
          <div className="token-identity"><div className="large-token-icon">{token.icon}</div><div><h3>{token.name}</h3><p>{token.symbol} · Testnet asset</p></div></div>
          <div className="token-stat"><span>Indicative price</span><strong>{token.price}</strong><small className={changeTone(token.change)}>{token.change} 24h</small></div>
          <div className="token-stat"><span>Wallet balance</span><strong>—</strong><small>Wallet integration pending</small></div>
          <div className="token-address"><span>Contract / identifier</span><code>{token.address}</code><small>Representative testnet identifier</small></div>
        </div>
        <div className="token-bottom"><div><span className="detail-label">Supported pairs</span><div className="pair-list">{token.pairs.map((pair) => <button key={pair} onClick={() => setSelectedToken(pair.split(' / ')[0])}>{pair}</button>)}</div></div><div className="validation-note"><strong>Validation note</strong><p>{token.note}</p></div></div>
      </section>

      <section className="activity-section" id="activity">
        <div className="section-title"><div><p className="eyebrow">ACTIVITY</p><h2>Recent trades</h2></div><button className="text-button" onClick={() => { setActiveTab('orders'); document.querySelector('.trade-panel')?.scrollIntoView({ behavior: 'smooth' }) }}>View orders →</button></div>
        <div className="activity-table"><div className="table-head"><span>Pair</span><span>Side</span><span>Amount</span><span>Price</span><span>Status</span></div>{DEMO_RECENT_TRADES.map((trade) => <div className="table-row" key={`${trade.pair}-${trade.price}`}><strong>{trade.pair}</strong><span>{trade.side}</span><span>{trade.amount}</span><span>{trade.price}</span><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>)}</div><p className="table-footnote">Representative demo history only; not loaded from the order API.</p>
      </section>
      <footer><a href="#trade">DexSYS / Exchange</a><span>Testnet environment · Quotes and token metadata are indicative</span><a href="#trade">Back to top ↑</a></footer>
      </div>
      {reviewOpen && <div className="modal-backdrop" role="presentation" onClick={() => setReviewOpen(false)}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close review" autoFocus onClick={() => setReviewOpen(false)}>×</button><span className="modal-kicker">LOCAL QUOTE PREVIEW</span><h2 id="review-title">Review quote</h2><p className="modal-copy">This frontend estimate does not create an API order.</p><div className="review-pair"><span>{from.icon} {from.symbol}</span><strong>{amount || '0'} <small>→</small> {quote} {to.symbol}</strong></div><div className="review-line"><span>Order API</span><strong>Not submitted</strong></div><div className="review-warning">No wallet provider or transaction service is connected. Backend and blockchain validation remain authoritative.</div><button className="primary-action" onClick={confirmSwap}>Close preview</button></section></div>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  )
}

export default App

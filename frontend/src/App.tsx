import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_RECENT_TRADES, DEMO_TOKENS } from './data/demoData'
import { getVisibleMarkets, selectMarketToken, type MarketFilter } from './domain/marketSelection'
import { calculateSwapQuote } from './domain/swapQuote'
import { getMaxAmount, reverseTokenPair } from './domain/swapState'
import { loadThemePreference, saveThemePreference } from './domain/themePreference'
import { getDemoOrderBook } from './domain/orderBook'
import { createOrder, getOrder, listOrders, type ApiOrderSide, type Order } from './services/orderService'
import { getMarketTokens } from './services/tokenService'
import TokenInput from './components/TokenInput'
import type { Token } from './types'
import './App.css'

const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W']
const chartPoints = '0,170 28,156 56,161 84,139 112,145 140,120 168,128 196,111 224,116 252,88 280,97 308,71 336,79 364,55 392,61 420,42 448,48 476,27 504,36 532,18 560,30 588,9 616,20 644,5'
const changeTone = (change: string) => change.startsWith('-') ? 'negative' : 'positive'
const supportedOrderPairs = new Set(['ETH/BTC', 'BTC/ETH'])

function App() {
  const [fromToken, setFromToken] = useState('ETH')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [activeTab, setActiveTab] = useState<'swap' | 'orders'>('swap')
  const [selectedToken, setSelectedToken] = useState('ETH')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadThemePreference(window.localStorage))
  const [timeframe, setTimeframe] = useState('1H')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all')
  const [marketSearch, setMarketSearch] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [orderSide, setOrderSide] = useState<ApiOrderSide>('Buy')
  const [orderQuantity, setOrderQuantity] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [orderUserId, setOrderUserId] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [refreshingOrderId, setRefreshingOrderId] = useState('')
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
  const demoOrderBook = getDemoOrderBook(`${from.symbol} / ${to.symbol}`)
  const tradingPair = `${from.symbol}/${to.symbol}`
  const orderPairSupported = supportedOrderPairs.has(tradingPair)

  useEffect(() => {
    if (activeTab !== 'orders' || apiStatus !== 'connected') return
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return undefined
      setOrdersLoading(true)
      setOrdersError('')
      return listOrders(controller.signal)
    }).then((loadedOrders) => {
      if (!controller.signal.aborted && loadedOrders !== undefined) setOrders(loadedOrders)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setOrdersError(error instanceof Error ? error.message : 'Unable to load orders.')
    }).finally(() => {
      if (!controller.signal.aborted) setOrdersLoading(false)
    })
    return () => controller.abort()
  }, [activeTab, apiStatus])

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

  const refreshOrder = async (id: string) => {
    setRefreshingOrderId(id)
    setOrdersError('')
    try {
      const refreshedOrder = await getOrder(id)
      setOrders((currentOrders) => currentOrders.map((order) => order.id === id ? refreshedOrder : order))
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to refresh this order.')
    } finally {
      setRefreshingOrderId('')
    }
  }

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOrderError('')
    setOrderSuccess('')
    if (apiStatus !== 'connected') {
      setOrderError('Connect to the backend before submitting an order.')
      return
    }
    if (!orderPairSupported) {
      setOrderError(`The backend does not support the ${tradingPair} trading pair.`)
      return
    }
    if (!orderUserId.trim()) {
      setOrderError('Enter a user ID. This value is unverified and is not wallet authentication.')
      return
    }
    const quantity = Number(orderQuantity)
    const price = Number(orderPrice)
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      setOrderError('Enter a valid positive base quantity and limit price.')
      return
    }
    setOrderSubmitting(true)
    try {
      const savedOrder = await createOrder({
        id: crypto.randomUUID(),
        user_id: orderUserId.trim(),
        trading_pair: tradingPair,
        side: orderSide,
        order_type: 'Limit',
        price,
        quantity,
        status: 'Pending',
      })
      setOrders((currentOrders) => [savedOrder, ...currentOrders.filter((order) => order.id !== savedOrder.id)])
      setOrderSuccess(`Order ${savedOrder.id} submitted · status: ${savedOrder.status}.`)
      setActiveTab('orders')
      setReviewOpen(false)
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Order submission failed.')
    } finally {
      setOrderSubmitting(false)
    }
  }

  return (
    <main className={`app-shell ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="announcement"><span className="announcement-dot" /> DexSYS Testnet · API-backed token metadata · Quotes are indicative <span className="announcement-link">Integration status</span></div>

      <header className="topbar">
        <a className="brand" href="#trade" aria-label="DexSYS home">
          <span className="brand-mark">D</span>
          <span><strong>DexSYS</strong><small>DECENTRALIZED EXCHANGE</small></span>
        </a>
        <nav className={`nav-links ${mobileMenuOpen ? 'open' : ''}`} id="primary-navigation" aria-label="Primary navigation">
          <a className="active" href="#trade" onClick={() => setMobileMenuOpen(false)}>Trade</a>
          <a href="#markets" onClick={() => setMobileMenuOpen(false)}>Markets</a>
          <a href="#activity" onClick={() => setMobileMenuOpen(false)}>Activity</a>
          <a href="#protocol" onClick={() => setMobileMenuOpen(false)}>Protocol</a>
        </nav>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'dark' ? '☼' : '◐'}</button>
          <button className="wallet-button" type="button" disabled title="Wallet integration is not available yet"><span className="status-dot" />Wallet pending</button>
          <button className="menu-button" type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="primary-navigation">{mobileMenuOpen ? '×' : '☰'}</button>
        </div>
      </header>

      <div className={`backend-status ${apiStatus}`} role="status" aria-live="polite">
        <span className="backend-status-message">{apiStatus === 'loading' ? 'Loading token data · representative demo values shown' : apiStatus === 'connected' ? 'DexSYS token API connected · backend values are currently seeded' : 'Token API unavailable · representative demo data shown'}</span>
        {apiError && <span className="backend-status-error" title={apiError}>{apiError}</span>}
        {apiStatus === 'offline' && <button type="button" onClick={() => { setApiStatus('loading'); setApiError(''); setRetryTokenLoad((attempt) => attempt + 1) }}>Retry</button>}
      </div>

      <section className="hero-copy" id="trade">
        <div>
          <p className="eyebrow">DEXSYS TESTNET · EXCHANGE PREVIEW</p>
          <h1>Markets, without the middleman.</h1>
          <p className="subtitle">A responsive trading workspace for the DexSYS API. Token metadata is backend-seeded; charts, orders, and quotes remain clearly marked as previews.</p>
          <div className="hero-actions"><a href="#terminal" className="primary-link">Open trading terminal <span>↗</span></a><a href="#protocol" className="secondary-link">Integration status</a></div>
        </div>
        <div className="network-card"><span>NETWORK</span><strong><i /> DexSYS Testnet</strong><small>Wallet and chain connection pending</small></div>
      </section>

      <section className="ticker-strip" aria-label="Market ticker">
        {tokens.map((item) => <button key={item.symbol} onClick={() => selectToken(item.symbol)}><span>{item.symbol}</span><strong>{item.price}</strong><em className={changeTone(item.change)}>{item.change}</em></button>)}
        <div className="ticker-more">MARKET HISTORY <strong>Not connected</strong></div>
      </section>

      <section className="terminal" id="terminal">
        <div className="terminal-main">
          <div className="market-header">
            <div className="pair-heading"><span className="pair-icon">{token.icon}</span><div><div className="pair-name">{token.symbol}<span>/ {token.symbol === 'USDC' ? 'USD' : 'USDC'}</span></div><small>DexSYS Testnet · indicative market</small></div></div>
            <div className="price-block"><strong>{token.price}</strong><span className={changeTone(token.change)}>{token.change}</span></div>
            <div className="market-stats"><span>24h high <b>Not available</b></span><span>24h low <b>Not available</b></span><span>Volume <b>Not provided by API</b></span></div>
          </div>

          <div className="chart-toolbar">
            <div className="chart-tabs"><button className="active" type="button">Chart</button><button type="button" disabled title="Depth data is not available">Depth</button><button type="button" onClick={() => document.getElementById('token-information')?.scrollIntoView({ behavior: 'smooth' })}>Info</button></div>
            <div className="timeframes">{timeframes.map((item) => <button key={item} className={timeframe === item ? 'active' : ''} onClick={() => setTimeframe(item)}>{item}</button>)}</div>
          </div>

          <div className="chart">
            <div className="chart-grid"><span>{token.price}</span><span>{token.price}</span><span>{token.price}</span><span>{token.price}</span><span>{token.price}</span></div>
            <svg viewBox="0 0 644 190" preserveAspectRatio="none" role="img" aria-label="Illustrative chart; historical price data is unavailable">
              <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopOpacity=".22" /><stop offset="1" stopOpacity="0" /></linearGradient></defs>
              <polyline className="chart-area" points={`0,190 ${chartPoints} 644,190`} />
              <polyline className="chart-line" points={chartPoints} />
            </svg>
            <div className="chart-cross"><span>{timeframe} · illustrative</span><b>{token.price}</b></div>
          </div>
          <p className="panel-footnote chart-disclaimer">Illustrative chart only · market history endpoint pending</p>

          <div className="orderbook">
            <div className="subhead"><h3>Order book</h3><span>Demo data</span></div>
            <div className="orderbook-grid">
              <div>
                <div className="orderbook-header"><span>Bid</span><span>Size</span></div>
                {demoOrderBook.bids.map((level) => (
                  <div className="orderbook-row" key={level.price}>
                    <strong>{level.price}</strong>
                    <span>{level.quantity}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="orderbook-header"><span>Ask</span><span>Size</span></div>
                {demoOrderBook.asks.map((level) => (
                  <div className="orderbook-row ask" key={level.price}>
                    <strong>{level.price}</strong>
                    <span>{level.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="panel-footnote">Sample order levels only · no live backend data is connected.</p>
          </div>
        </div>

        <aside className="trade-panel">
          <div className="panel-tabs"><button className={activeTab === 'swap' ? 'active' : ''} onClick={() => setActiveTab('swap')}>Swap</button><button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>Orders</button></div>
          {activeTab === 'swap' ? <div className="swap-panel">
            <div className="panel-title"><div><h2>Swap preview</h2><p>Frontend quote · not an order.</p></div><span>Indicative</span></div>
            <TokenInput label="You pay" token={from} amount={amount} tokens={tokens} balanceLabel={apiStatus === 'connected' ? 'API seed' : 'Demo / seed'} onAmountChange={setAmount} onTokenChange={selectToken} onMax={maxAmount} disabledToken={to.symbol} />
            <button className="switch-button" aria-label="Switch tokens" onClick={switchTokens}>↕</button>
            <TokenInput label="You receive" token={to} amount={quote} tokens={tokens} balanceLabel={apiStatus === 'connected' ? 'API seed' : 'Demo / seed'} onAmountChange={() => undefined} onTokenChange={setToToken} disabledToken={from.symbol} readOnly />
            <div className="quote-details"><span>Indicative rate</span><strong>1 {from.symbol} ≈ {calculateSwapQuote('1', from, to)} {to.symbol}</strong><span>Price impact</span><strong>Unavailable</strong><span>Network fee</span><strong>Not connected</strong></div>
            <button className="primary-action" disabled={!amount || Number(amount) <= 0} onClick={() => { setOrderError(''); setOrderSuccess(''); setReviewOpen(true) }}>{!amount ? 'Enter an amount' : 'Review quote preview'}</button>
            <p className="panel-footnote">Local estimate only · no order or transaction is submitted</p>
          </div> : <div className="orders-panel">
            <div className="panel-title"><div><h2>Backend orders</h2><p>Persisted API order history · limit orders only.</p></div></div>
            {orderSuccess && <p className="order-feedback order-success" role="status">{orderSuccess}</p>}
            {apiStatus !== 'connected' && <p className="order-feedback order-error">Connect to the backend to load persisted orders. Demo rows are not shown as live history.</p>}
            {ordersLoading && <p className="order-feedback" role="status">Loading orders…</p>}
            {ordersError && <p className="order-feedback order-error" role="alert">{ordersError}</p>}
            {apiStatus === 'connected' && !ordersLoading && !ordersError && orders.length === 0 && <p className="order-feedback">No persisted orders yet.</p>}
            {orders.map((order) => <div className="order-row" key={order.id}>
              <div><strong>{order.trading_pair}</strong><span>{order.side} · {order.quantity} · {order.order_type}</span></div>
              <div className="order-price"><strong>{order.price ?? 'Market'}</strong><span>{order.status}</span><button className="order-refresh" disabled={refreshingOrderId === order.id} onClick={() => void refreshOrder(order.id)}>{refreshingOrderId === order.id ? 'Refreshing…' : 'Refresh'}</button></div>
            </div>)}
          </div>}
        </aside>
      </section>

      <section className="markets-section" id="markets">
        <div className="section-heading"><div><p className="eyebrow">MARKETS</p><h2>Explore assets</h2></div><div className="market-tools"><input value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} placeholder="Search assets" aria-label="Search assets" /><button className={marketFilter === 'all' ? 'filter-active' : ''} onClick={() => setMarketFilter('all')}>All</button><button className={marketFilter === 'movers' ? 'filter-active' : ''} onClick={() => setMarketFilter('movers')}>Top movers</button></div></div>
        <div className="market-table">
          <div className="market-head"><span>Asset</span><span>Price</span><span>24h change</span><span>24h volume</span><span>Action</span></div>
          {visibleMarkets.map((item) => <button className={`market-table-row ${item.symbol === selectedToken ? 'selected-market' : ''}`} key={item.symbol} onClick={() => selectToken(item.symbol)}><span className="asset-cell"><i>{item.icon}</i><b>{item.name}</b><small>{item.symbol}</small></span><strong>{item.price}</strong><span className={changeTone(item.change)}>{item.change}</span><span>Not provided</span><span className="trade-arrow">Trade ↗</span></button>)}
          {visibleMarkets.length === 0 && <div className="empty-state">No supported assets match your search.</div>}
        </div>
        <p className="panel-footnote">API prices and seed balances are indicative; wallet balances and market volume are not connected.</p>
      </section>

      <section className="protocol-section" id="protocol">
        <div><p className="eyebrow">BUILT FOR TRANSPARENCY</p><h2>Trading infrastructure,<br /><span>without the black box.</span></h2></div>
        <div className="protocol-grid">
          <article><span>01</span><h3>Integration boundary</h3><p>The frontend does not custody assets or connect a wallet yet.</p></article>
          <article><span>02</span><h3>Visible data status</h3><p>Token metadata comes from the Rust API; chart history and orderbook data are unavailable.</p></article>
          <article><span>03</span><h3>Composable services</h3><p>Typed frontend services prepare the interface for backend contracts as they are implemented.</p></article>
        </div>
      </section>

      <section className="activity-section" id="activity">
        <div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Sample trade history</h2></div></div>
        <p className="panel-footnote">Representative demo data only · not loaded from the order API</p>
        <div className="activity-table"><div className="table-head"><span>Time</span><span>Pair</span><span>Side</span><span>Amount</span><span>Price</span><span>Status</span></div>{DEMO_RECENT_TRADES.map((trade, index) => <div className="table-row" key={`${index}-${trade.pair}`}><span>Demo</span><strong>{trade.pair}</strong><span>{trade.side}</span><span>{trade.amount}</span><span>{trade.price}</span><span className={trade.status === 'Filled' ? 'positive' : ''}>{trade.status}</span></div>)}</div>
      </section>

      <section className="token-section" id="token-information" aria-labelledby="token-information-title">
        <div className="section-heading"><div><p className="eyebrow">ASSET REGISTRY</p><h2 id="token-information-title">Token information</h2></div><span className="validation-badge">{token.validation}</span></div>
        <div className="token-detail-grid">
          <div className="token-identity"><div className="large-token-icon">{token.icon}</div><div><h3>{token.name}</h3><p>{token.symbol} · Testnet asset</p></div></div>
          <div className="token-stat"><span>Indicative price</span><strong>{token.price}</strong><small className={changeTone(token.change)}>{token.change} 24h</small></div>
          <div className="token-stat"><span>Wallet balance</span><strong>—</strong><small>Wallet integration pending</small></div>
          <div className="token-address"><span>Contract / identifier</span><code>{token.address}</code><small>Backend-seeded identifier</small></div>
        </div>
        <div className="token-bottom"><div><span className="detail-label">Supported pairs</span><div className="pair-list">{token.pairs.map((pair) => <button key={pair} onClick={() => selectToken(pair.split(' / ')[0])}>{pair}</button>)}</div></div><div className="validation-note"><strong>Validation note</strong><p>{token.note}</p></div></div>
      </section>

      <footer id="footer"><div><strong>DexSYS</strong><span>Decentralized exchange infrastructure</span></div><div><span>Testnet environment</span><span>Token values are seeded and indicative</span></div></footer>

      {reviewOpen && <div className="modal-backdrop" role="presentation" onClick={() => { if (!orderSubmitting) setReviewOpen(false) }}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close review" autoFocus disabled={orderSubmitting} onClick={() => setReviewOpen(false)}>×</button><p className="eyebrow">ORDER REQUEST</p><h2 id="review-title">Submit a limit order</h2><p className="modal-copy">The quote below is illustrative. Order details are entered separately and submitted to the backend.</p><div className="review-route"><div><span>Preview only</span><strong>{amount || '0'} {from.symbol} → {quote} {to.symbol}</strong></div></div>
        <form className="order-form" onSubmit={(event) => void submitOrder(event)}>
          <div className="order-form-heading"><strong>Limit order</strong><span>Market orders unsupported</span></div>
          <div className="order-side-control" role="group" aria-label="Order side">
            <button type="button" className={orderSide === 'Buy' ? 'selected' : ''} onClick={() => setOrderSide('Buy')}>Buy</button>
            <button type="button" className={orderSide === 'Sell' ? 'selected' : ''} onClick={() => setOrderSide('Sell')}>Sell</button>
          </div>
          <label>User ID <span>(unverified; no wallet/auth connected)</span><input required value={orderUserId} onChange={(event) => setOrderUserId(event.target.value)} autoComplete="off" /></label>
          <label>Trading pair<input readOnly value={tradingPair} /></label>
          <label>Base quantity ({from.symbol})<input required type="number" min="0" step="any" value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)} /></label>
          <label>Limit price ({to.symbol} per {from.symbol})<input required type="number" min="0" step="any" value={orderPrice} onChange={(event) => setOrderPrice(event.target.value)} /></label>
          {!orderPairSupported && <p className="order-feedback order-error">The backend currently supports ETH/BTC and BTC/ETH only. Change the preview pair to submit.</p>}
          {apiStatus !== 'connected' && <p className="order-feedback order-error">Backend unavailable. Order submission is disabled until API token metadata loads.</p>}
          {orderError && <p className="order-feedback order-error" role="alert">{orderError}</p>}
          {orderSuccess && <p className="order-feedback order-success" role="status">{orderSuccess}</p>}
          <button className="primary-action" type="submit" disabled={orderSubmitting || apiStatus !== 'connected' || !orderPairSupported}>{orderSubmitting ? 'Submitting…' : 'Submit limit order'}</button>
          <p className="panel-footnote">No wallet signature is requested. Settlement and blockchain confirmation are not provided.</p>
        </form>
      </section></div>}
    </main>
  )
}

export default App

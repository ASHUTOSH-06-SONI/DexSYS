import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_TOKENS } from './data/demoData'
import { getVisibleMarkets, selectMarketToken, type MarketFilter } from './domain/marketSelection'
import { activityFilters, filterOrders, type ActivityFilter } from './domain/orderActivity'
import { loadThemePreference, saveThemePreference } from './domain/themePreference'
import { createOrder, getOrder, listOrders, type ApiOrderSide, type Order } from './services/orderService'
import { getMarketTokens } from './services/tokenService'
import type { Token } from './types'
import './App.css'

const supportedPairs = ['ETH/BTC', 'BTC/ETH']
type ChartTab = 'chart' | 'depth' | 'info'
type OrderPanelTab = 'entry' | 'orders'

const changeTone = (change: string) => change.startsWith('-') ? 'negative' : 'positive'

function App() {
  const [theme, setTheme] = useState(() => loadThemePreference(window.localStorage))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('trade')
  const [apiTokens, setApiTokens] = useState<Token[] | null>(null)
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'offline'>('loading')
  const [apiError, setApiError] = useState('')
  const [retryTokenLoad, setRetryTokenLoad] = useState(0)
  const [selectedToken, setSelectedToken] = useState('ETH')
  const [tradingPair, setTradingPair] = useState('ETH/BTC')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all')
  const [chartTab, setChartTab] = useState<ChartTab>('chart')
  const [orderPanelTab, setOrderPanelTab] = useState<OrderPanelTab>('entry')
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
  const [ordersRevision, setOrdersRevision] = useState(0)
  const [refreshingOrderId, setRefreshingOrderId] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('All')

  const tokens = apiTokens ?? DEMO_TOKENS
  const token = tokens.find((item) => item.symbol === selectedToken) ?? tokens[0]
  const visibleMarkets = getVisibleMarkets(tokens, marketSearch, marketFilter)
  const [baseSymbol, quoteSymbol] = tradingPair.split('/')
  const baseToken = tokens.find((item) => item.symbol === baseSymbol) ?? token
  const orderPairSupported = supportedPairs.includes(tradingPair)
  const openOrders = orders.filter((order) => order.status === 'Pending')
  const activityOrders = filterOrders(orders, activityFilter)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveThemePreference(window.localStorage, theme)
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    getMarketTokens(controller.signal).then((loadedTokens) => {
      if (controller.signal.aborted) return
      setApiTokens(loadedTokens)
      setApiStatus('connected')
      setSelectedToken(loadedTokens[0].symbol)
      const seededPair = supportedPairs.find((pair) => pair.startsWith(`${loadedTokens[0].symbol}/`))
      if (seededPair) setTradingPair(seededPair)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setApiTokens(null)
      setApiStatus('offline')
      setApiError(error instanceof Error ? error.message : 'The token service is unavailable.')
    })
    return () => controller.abort()
  }, [retryTokenLoad])

  useEffect(() => {
    if (apiStatus !== 'connected') return
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
  }, [apiStatus, ordersRevision])

  useEffect(() => {
    const updateActiveSection = () => setActiveSection(window.location.hash.slice(1) || 'trade')
    window.addEventListener('hashchange', updateActiveSection)
    updateActiveSection()
    return () => window.removeEventListener('hashchange', updateActiveSection)
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const selectToken = (symbol: string) => {
    const selection = selectMarketToken(symbol, baseSymbol, quoteSymbol, tokens)
    setSelectedToken(selection.selectedToken)
    const nextPair = `${selection.fromToken}/${selection.toToken}`
    if (supportedPairs.includes(nextPair)) setTradingPair(nextPair)
  }

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOrderError('')
    setOrderSuccess('')
    if (apiStatus !== 'connected') {
      setOrderError('The token API must be connected before an order can be submitted.')
      return
    }
    if (!orderPairSupported) {
      setOrderError(`The backend does not support ${tradingPair}.`)
      return
    }
    if (!orderUserId.trim()) {
      setOrderError('Enter a user ID. This is unverified and is not wallet authentication.')
      return
    }
    const quantity = Number(orderQuantity)
    const price = Number(orderPrice)
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      setOrderError('Enter a valid positive quantity and limit price.')
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
      setOrders((current) => [savedOrder, ...current.filter((item) => item.id !== savedOrder.id)])
      setOrderSuccess(`Order submitted. Current backend status: ${savedOrder.status}.`)
      setOrderPanelTab('orders')
      setOrdersRevision((revision) => revision + 1)
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Order submission failed.')
    } finally {
      setOrderSubmitting(false)
    }
  }

  const refreshOrder = async (id: string) => {
    setRefreshingOrderId(id)
    setOrdersError('')
    try {
      const refreshedOrder = await getOrder(id)
      setOrders((current) => current.map((item) => item.id === id ? refreshedOrder : item))
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to refresh this order.')
    } finally {
      setRefreshingOrderId('')
    }
  }

  const reloadOrders = () => setOrdersRevision((revision) => revision + 1)

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#trade" aria-label="DexSYS trade">
          <span className="brand-mark">D</span>
          <span className="brand-name">DexSYS <small>EXCHANGE</small></span>
        </a>
        <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`} id="primary-navigation" aria-label="Primary navigation">
          {['Trade', 'Markets', 'Activity', 'Protocol'].map((item) => (
            <a key={item} className={activeSection === item.toLowerCase() ? 'active' : ''} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}>{item}</a>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button theme-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? '☼' : '◐'}</button>
          <button className="wallet-button" type="button" disabled title="Wallet integration is not available yet"><span className="status-dot" />Wallet pending</button>
          <button className="icon-button menu-button" type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="primary-navigation">{mobileMenuOpen ? '×' : '☰'}</button>
        </div>
      </header>

      <div className={`backend-status ${apiStatus}`} role="status" aria-live="polite">
        <span className="status-dot" />
        <span>{apiStatus === 'loading' ? 'Connecting to token API · demo metadata shown until connected' : apiStatus === 'connected' ? 'Token API connected · backend values are seeded and indicative' : 'Token API unavailable · demo metadata shown'}</span>
        {apiError && <span className="backend-status-error" title={apiError}>{apiError}</span>}
        {apiStatus === 'offline' && <button type="button" onClick={() => { setApiStatus('loading'); setApiError(''); setRetryTokenLoad((attempt) => attempt + 1) }}>Retry</button>}
      </div>

      <div className="page-content">
        <section className="trade-section" id="trade">
          <div className="page-heading trade-heading">
            <div><p className="eyebrow">DEXSYS TESTNET</p><h1>Trade</h1><p className="page-description">Limit-order trading workspace. Token data is seeded; market data and wallet connectivity are unavailable.</p></div>
            <span className="environment-badge"><i /> TEST ENVIRONMENT</span>
          </div>

          <div className="market-summary">
            <div className="summary-pair">
              <span className="token-avatar">{baseToken.icon}</span>
              <div><strong>{tradingPair}</strong><small>Indicative pair · {orderPairSupported ? 'order entry enabled' : 'unsupported pair'}</small></div>
              <select value={tradingPair} onChange={(event) => setTradingPair(event.target.value)} aria-label="Trading pair">
                {supportedPairs.map((pair) => <option key={pair} value={pair}>{pair}</option>)}
              </select>
            </div>
            <div className="summary-stat"><span>Pair price</span><strong>Not provided</strong></div>
            <div className="summary-stat"><span>24h change</span><strong>Unavailable</strong></div>
            <div className="summary-stat"><span>24h volume</span><strong>Unavailable</strong></div>
          </div>

          <div className="terminal-grid">
            <section className="panel chart-panel" aria-label="Market chart and order book">
              <div className="chart-toolbar">
                <div className="chart-tabs" role="tablist" aria-label="Market data view">
                  {(['chart', 'depth', 'info'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={chartTab === tab} className={chartTab === tab ? 'selected' : ''} disabled={tab === 'depth'} title={tab === 'depth' ? 'Live order-book depth is not available' : undefined} onClick={() => setChartTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
                </div>
                <div className="timeframes" aria-label="Historical intervals unavailable">{['5m', '15m', '1h', '4h', '1d'].map((interval) => <button key={interval} type="button" disabled title="Historical price data is not available">{interval}</button>)}</div>
              </div>
              {chartTab === 'chart' && <div className="chart-empty" role="img" aria-label="Historical market chart unavailable">
                <span className="chart-icon" aria-hidden="true">⌁</span>
                <strong>Market history unavailable</strong>
                <p>DexSYS has no historical price feed connected. No chart values are simulated.</p>
              </div>}
              {chartTab === 'info' && <div className="chart-info">
                <span className="eyebrow">PAIR INFORMATION</span>
                <h2>{tradingPair}</h2>
                <p>Trading pair is enabled in the seeded backend registry. Pair-level prices, volume and liquidity are not returned by the API.</p>
                <div><span>Matching</span><strong>In-memory limit-order engine</strong></div>
                <div><span>Settlement</span><strong>Not connected to chain</strong></div>
              </div>}
              <div className="chart-footnote"><span>MARKET DATA</span><span>Not connected</span></div>
              <div className="orderbook">
                <div className="panel-heading compact"><div><h2>Order book</h2><p>Live depth feed unavailable</p></div><span className="data-badge">NO LIVE DATA</span></div>
                <div className="orderbook-head"><span>PRICE</span><span>SIZE</span><span>TOTAL</span></div>
                <div className="orderbook-empty">Order-book levels are not provided by the API.</div>
              </div>
            </section>

            <aside className="panel trade-panel">
              <div className="panel-tabs" role="tablist" aria-label="Order panel">
                <button type="button" role="tab" aria-selected={orderPanelTab === 'entry'} className={orderPanelTab === 'entry' ? 'selected' : ''} onClick={() => setOrderPanelTab('entry')}>Order entry</button>
                <button type="button" role="tab" aria-selected={orderPanelTab === 'orders'} className={orderPanelTab === 'orders' ? 'selected' : ''} onClick={() => setOrderPanelTab('orders')}>Open orders <span>{openOrders.length}</span></button>
              </div>
              {orderPanelTab === 'entry' ? <form className="order-form" onSubmit={(event) => void submitOrder(event)}>
                <div className="order-title"><div><h2>Place limit order</h2><p>{tradingPair}</p></div><span className="data-badge">LIMIT ONLY</span></div>
                <div className="side-selector" role="group" aria-label="Order side">
                  <button type="button" className={orderSide === 'Buy' ? 'buy selected' : 'buy'} onClick={() => setOrderSide('Buy')}>Buy / Long</button>
                  <button type="button" className={orderSide === 'Sell' ? 'sell selected' : 'sell'} onClick={() => setOrderSide('Sell')}>Sell</button>
                </div>
                <label className="field-label">Limit price <span>{quoteSymbol} per {baseSymbol}</span>
                  <div className="field-control"><input required type="number" min="0" step="any" placeholder="0.00" value={orderPrice} onChange={(event) => setOrderPrice(event.target.value)} /><span>{quoteSymbol}</span></div>
                </label>
                <label className="field-label">Quantity <span>Base amount</span>
                  <div className="field-control"><input required type="number" min="0" step="any" placeholder="0.00" value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)} /><span>{baseSymbol}</span></div>
                </label>
                <label className="field-label">User ID <span className="unverified-label">Unverified identifier</span>
                  <input className="text-control" required autoComplete="off" placeholder="Enter an identifier" value={orderUserId} onChange={(event) => setOrderUserId(event.target.value)} />
                </label>
                <div className="order-warning">This is not wallet authentication. No signature, balance check, or settlement is performed.</div>
                {apiStatus !== 'connected' && <p className="feedback error" role="alert">Order entry is unavailable until the backend token API connects.</p>}
                {!orderPairSupported && <p className="feedback error" role="alert">This pair is not supported by the order API.</p>}
                {orderError && <p className="feedback error" role="alert">{orderError}</p>}
                {orderSuccess && <p className="feedback success" role="status">{orderSuccess}</p>}
                <button className={`submit-order ${orderSide === 'Sell' ? 'sell-action' : ''}`} type="submit" disabled={orderSubmitting || apiStatus !== 'connected' || !orderPairSupported}>{orderSubmitting ? 'Submitting order…' : `${orderSide} ${tradingPair}`}</button>
                <p className="form-footnote">Market orders are unsupported. API response is authoritative for order status.</p>
              </form> : <div className="open-orders-panel">
                <div className="panel-heading compact"><div><h2>Open orders</h2><p>Persisted backend records</p></div><button className="text-button" type="button" onClick={reloadOrders} disabled={ordersLoading}>Refresh</button></div>
                {ordersLoading && <p className="empty-state" role="status">Loading persisted orders…</p>}
                {ordersError && <p className="feedback error" role="alert">{ordersError}</p>}
                {!ordersLoading && !ordersError && apiStatus === 'connected' && openOrders.length === 0 && <p className="empty-state">No open orders.</p>}
                {!ordersLoading && openOrders.slice(0, 8).map((order) => <OrderRow key={order.id} order={order} onRefresh={refreshOrder} refreshing={refreshingOrderId === order.id} compact />)}
                {apiStatus !== 'connected' && <p className="empty-state">Backend order history requires an API connection.</p>}
                <a className="all-orders-link" href="#activity" onClick={() => setActiveSection('activity')}>View all activity <span>→</span></a>
              </div>}
            </aside>
          </div>
        </section>

        <section className="content-section" id="markets">
          <SectionHeading eyebrow="MARKETS" title="Token markets" description="Backend-seeded token prices and metadata. Pair-level market data is not available." />
          <div className="market-controls">
            <label className="search-control"><span aria-hidden="true">⌕</span><input value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} placeholder="Search tokens" aria-label="Search tokens" /></label>
            <div className="filter-control" role="group" aria-label="Market sort">
              <button type="button" className={marketFilter === 'all' ? 'selected' : ''} onClick={() => setMarketFilter('all')}>All assets</button>
              <button type="button" className={marketFilter === 'movers' ? 'selected' : ''} onClick={() => setMarketFilter('movers')}>Largest moves</button>
            </div>
          </div>
          <div className="table-scroll">
            <div className="data-table market-table">
              <div className="table-header market-columns"><span>ASSET / PAIRS</span><span>INDICATIVE PRICE</span><span>24H CHANGE</span><span>VOLUME</span><span /></div>
              {visibleMarkets.map((item) => <button className="table-row market-columns" key={item.symbol} type="button" onClick={() => selectToken(item.symbol)}>
                <span className="asset-cell"><i className="token-avatar">{item.icon}</i><span><strong>{item.name}</strong><small>{item.symbol} · {item.pairs.join(', ') || 'No supported pairs returned'}</small></span></span>
                <strong>{item.price}</strong><span className={changeTone(item.change)}>{item.change}</span><span className="muted">Not provided</span><span className="trade-link">Select <b>→</b></span>
              </button>)}
              {visibleMarkets.length === 0 && <p className="empty-state">No assets match that search.</p>}
            </div>
          </div>
          <p className="section-footnote">Prices, change and balances are seeded backend metadata; they are not a live market feed. Volume is not returned by the API.</p>
        </section>

        <section className="content-section" id="activity">
          <SectionHeading eyebrow="ACCOUNT ACTIVITY" title="Order history" description="Persisted order records returned by the DexSYS API. No sample trades are shown as user activity." />
          <div className="activity-toolbar">
            <div className="filter-control" role="tablist" aria-label="Filter order status">
              {activityFilters.map((filter) => <button type="button" role="tab" aria-selected={activityFilter === filter} className={activityFilter === filter ? 'selected' : ''} key={filter} onClick={() => setActivityFilter(filter)}>{filter}</button>)}
            </div>
            <div className="activity-source"><span className={`source-dot ${apiStatus === 'connected' ? 'active' : ''}`} />{apiStatus === 'connected' ? 'LIVE API RECORDS' : 'API UNAVAILABLE'}<button className="text-button" type="button" disabled={apiStatus !== 'connected' || ordersLoading} onClick={reloadOrders}>{ordersLoading ? 'Loading…' : 'Refresh'}</button></div>
          </div>
          {ordersError && <p className="feedback error" role="alert">{ordersError}</p>}
          {apiStatus !== 'connected' && <div className="state-panel"><strong>Order history unavailable</strong><p>Connect to the backend to read persisted orders. Demo trades are intentionally excluded.</p></div>}
          {apiStatus === 'connected' && ordersLoading && <div className="state-panel" role="status"><strong>Loading order history</strong><p>Fetching persisted orders from the DexSYS API…</p></div>}
          {apiStatus === 'connected' && !ordersLoading && !ordersError && activityOrders.length === 0 && <div className="state-panel"><strong>No {activityFilter === 'All' ? '' : activityFilter.toLowerCase() + ' '}orders found</strong><p>Orders accepted by the backend will appear here.</p></div>}
          {apiStatus === 'connected' && !ordersLoading && activityOrders.length > 0 && <div className="table-scroll">
            <div className="data-table activity-table">
              <div className="table-header activity-columns"><span>TIME</span><span>TRADING PAIR</span><span>SIDE</span><span>TYPE</span><span>PRICE</span><span>QUANTITY</span><span>FILLED</span><span>STATUS</span><span /></div>
              {activityOrders.map((order) => <div className="table-row activity-columns" key={order.id}>
                <span className="muted">Unavailable</span><strong>{order.trading_pair}</strong><span className={order.side === 'Buy' ? 'positive' : 'negative'}>{order.side}</span><span>{order.order_type}</span><span>{order.price ?? '—'}</span><span>{order.quantity}</span><span className="muted">Unavailable</span><StatusBadge status={order.status} /><button className="text-button row-refresh" type="button" onClick={() => void refreshOrder(order.id)} disabled={refreshingOrderId === order.id}>{refreshingOrderId === order.id ? 'Refreshing…' : 'Refresh'}</button>
              </div>)}
            </div>
          </div>}
          <p className="section-footnote">The current order API does not return creation time, remaining quantity or executed quantity; these fields are shown as unavailable rather than inferred.</p>
        </section>

        <section className="content-section protocol-section" id="protocol">
          <SectionHeading eyebrow="PROTOCOL" title="DexSYS registry" description="Available token metadata and integration boundaries reported by the current backend." />
          <div className="protocol-grid">
            {tokens.map((item) => <article className="protocol-token" key={item.symbol}>
              <div className="protocol-token-heading"><i className="token-avatar">{item.icon}</i><div><h3>{item.name}</h3><span>{item.symbol}</span></div><span className={`status-badge validation ${item.validation === 'Validated' ? 'valid' : 'unvalidated'}`}>{item.validation}</span></div>
              <div className="protocol-fields"><span>Indicative price</span><strong>{item.price}</strong><span>24h change</span><strong className={changeTone(item.change)}>{item.change}</strong><span>Seed balance</span><strong>{item.balance.toLocaleString()} {item.symbol} <small>· not a wallet balance</small></strong><span>Contract / identifier</span><code>{item.address || 'Not provided'}</code></div>
              <div className="protocol-pairs"><span>Supported pairs</span><div>{item.pairs.length ? item.pairs.map((pair) => <span className="pair-badge" key={pair}>{pair}</span>) : <span className="muted">Not provided</span>}</div></div>
              <p className="section-footnote">{item.note}</p>
            </article>)}
          </div>
          <div className="protocol-boundaries">
            <div><span>Order matching</span><strong>In-memory engine</strong><small>Orders are persisted through the API; PostgreSQL is not the live orderbook.</small></div>
            <div><span>Wallet</span><strong>Not connected</strong><small>No wallet identity, signatures or balances are verified.</small></div>
            <div><span>Settlement</span><strong>Not connected</strong><small>Database status is not proof of on-chain confirmation.</small></div>
          </div>
        </section>

        <footer className="site-footer"><a className="brand" href="#trade"><span className="brand-mark">D</span><span className="brand-name">DexSYS <small>EXCHANGE</small></span></a><span>Test environment · seeded data · no wallet connected</span></footer>
      </div>
    </main>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>
}

function OrderRow({ order, onRefresh, refreshing, compact = false }: { order: Order; onRefresh: (id: string) => void; refreshing: boolean; compact?: boolean }) {
  return <div className={`open-order-row ${compact ? 'compact' : ''}`}>
    <div><strong>{order.trading_pair}</strong><span className={order.side === 'Buy' ? 'positive' : 'negative'}>{order.side} · {order.quantity} {order.order_type}</span></div>
    <div><strong>{order.price ?? '—'}</strong><StatusBadge status={order.status} /></div>
    <button className="text-button" type="button" onClick={() => onRefresh(order.id)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
  </div>
}

function StatusBadge({ status }: { status: Order['status'] | 'Pending' }) {
  const tone = status === 'Filled' ? 'filled' : status === 'Cancelled' ? 'cancelled' : 'open'
  return <span className={`status-badge ${tone}`}>{status}</span>
}

export default App

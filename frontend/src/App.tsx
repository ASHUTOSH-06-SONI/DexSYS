import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { DEMO_TOKENS } from './data/demoData'
import { getVisibleMarkets, selectMarketToken, type MarketFilter } from './domain/marketSelection'
import { activityFilters, filterOrders, type ActivityFilter } from './domain/orderActivity'
import { loadThemePreference, saveThemePreference } from './domain/themePreference'
import { applyMarketPrices, getMarketPrices, MARKET_PRICE_REFRESH_MS, MARKET_PRICE_SYMBOLS, type MarketPrices } from './services/marketDataService'
import { isMarketPair, MARKET_CANDLE_INTERVALS, type MarketCandleInterval, type MarketCandleUpdate, type MarketPair } from './services/marketCandleService'
import { subscribeToMarketTicker, type MarketConnectionStatus } from './services/marketTickerService'
import OrderBookDepth from './components/OrderBookDepth'
import { cancelOrder, createOrder, getOrder, listOrders, type ApiOrderSide, type Order } from './services/orderService'
import { getMarketTokens } from './services/tokenService'
import type { Token } from './types'
import './App.css'

const MarketChart = lazy(() => import('./components/MarketChart'))
const supportedPairs: MarketPair[] = ['ETH/BTC', 'BTC/ETH']
type ChartTab = 'chart' | 'depth' | 'info'
type OrderPanelTab = 'entry' | 'orders'

const changeTone = (change: string) => change.startsWith('-') ? 'negative' : 'positive'

type MarketFeedState = {
  status: 'loading' | 'live' | 'stale' | 'error'
  prices: MarketPrices | null
  updatedAt: number | null
  refreshing: boolean
  error: string
}

type MarketStreamState = {
  status: MarketConnectionStatus
  price: number | null
  updatedAt: number | null
}

function formatPairPrice(price: number) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 }).format(price)
}

function App() {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0()
  const [theme, setTheme] = useState(() => loadThemePreference(window.localStorage))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('trade')
  const [apiTokens, setApiTokens] = useState<Token[] | null>(null)
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'offline'>('loading')
  const [apiError, setApiError] = useState('')
  const [retryTokenLoad, setRetryTokenLoad] = useState(0)
  const [marketFeed, setMarketFeed] = useState<MarketFeedState>({
    status: 'loading',
    prices: null,
    updatedAt: null,
    refreshing: false,
    error: '',
  })
  const [retryMarketLoad, setRetryMarketLoad] = useState(0)
  const [retryMarketStream, setRetryMarketStream] = useState(0)
  const [marketStream, setMarketStream] = useState<MarketStreamState>({
    status: 'connecting',
    price: null,
    updatedAt: null,
  })
  const [selectedToken, setSelectedToken] = useState('ETH')
  const [tradingPair, setTradingPair] = useState('ETH/BTC')
  const [chartInterval, setChartInterval] = useState<MarketCandleInterval>('1m')
  const [marketCandle, setMarketCandle] = useState<(MarketCandleUpdate & { receivedAt: number }) | null>(null)
  const [marketSearch, setMarketSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all')
  const [chartTab, setChartTab] = useState<ChartTab>('chart')
  const [orderPanelTab, setOrderPanelTab] = useState<OrderPanelTab>('entry')
  const [orderSide, setOrderSide] = useState<ApiOrderSide>('Buy')
  const [orderQuantity, setOrderQuantity] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersOwnerSubject, setOrdersOwnerSubject] = useState<string | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersRevision, setOrdersRevision] = useState(0)
  const [refreshingOrderId, setRefreshingOrderId] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('All')

  const tokens = applyMarketPrices(apiTokens ?? DEMO_TOKENS, marketFeed.prices ?? {})
  const token = tokens.find((item) => item.symbol === selectedToken) ?? tokens[0]
  const visibleMarkets = getVisibleMarkets(tokens, marketSearch, marketFilter)
  const [baseSymbol, quoteSymbol] = tradingPair.split('/')
  const baseToken = tokens.find((item) => item.symbol === baseSymbol) ?? token
  const baseMarketPrice = marketFeed.prices?.[baseSymbol as keyof MarketPrices]
  const quoteMarketPrice = marketFeed.prices?.[quoteSymbol as keyof MarketPrices]
  const pairPrice = marketStream.price !== null
    ? tradingPair === 'BTC/ETH' ? 1 / marketStream.price : marketStream.price
    : null
  const pairChange = baseMarketPrice && quoteMarketPrice && baseMarketPrice.change24h > -100 && quoteMarketPrice.change24h > -100
    ? ((1 + baseMarketPrice.change24h / 100) / (1 + quoteMarketPrice.change24h / 100) - 1) * 100
    : null
  const marketUpdatedAt = marketFeed.updatedAt
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(marketFeed.updatedAt)
    : ''
  const marketStreamUpdatedAt = marketStream.updatedAt
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(marketStream.updatedAt)
    : ''
  const marketFeedMessage = marketFeed.status === 'loading'
    ? 'CoinGecko REST · loading USD reference prices; seeded/demo values shown until available'
    : marketFeed.status === 'live'
      ? `CoinGecko REST · USD reference prices · updated ${marketUpdatedAt} · refreshes every 60 seconds${marketFeed.refreshing ? ' · refreshing' : ''}`
      : marketFeed.status === 'stale'
        ? `CoinGecko REST unavailable · showing stale USD references from ${marketUpdatedAt}`
        : 'CoinGecko REST unavailable · showing seeded/demo USD references'
  const marketStreamMessage = marketStream.status === 'connecting'
    ? `Binance WebSocket · ETHBTC ticker + ${chartInterval} kline · connecting · last ticker update ${marketStreamUpdatedAt || 'not received yet'}${marketStream.updatedAt ? ' · showing stale price' : ''}`
    : marketStream.status === 'live'
      ? `Binance WebSocket · ETHBTC ticker + ${chartInterval} kline · live · last ticker update ${marketStreamUpdatedAt}`
      : marketStream.status === 'reconnecting'
        ? `Binance WebSocket · ETHBTC ticker + ${chartInterval} kline · reconnecting · last ticker update ${marketStreamUpdatedAt || 'not received yet'}${marketStream.updatedAt ? ' · price is stale' : ''}`
        : `Binance WebSocket · ETHBTC ticker + ${chartInterval} kline · disconnected/stale · last ticker update ${marketStreamUpdatedAt || 'not received yet'}`
  const orderPairSupported = isMarketPair(tradingPair)
  const visibleOrders = isAuthenticated && user?.sub === ordersOwnerSubject ? orders : []
  const openOrders = visibleOrders.filter((order) => order.status === 'Pending')
  const activityOrders = filterOrders(visibleOrders, activityFilter)

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
    const controller = new AbortController()
    let refreshTimer: number | undefined

    const refreshPrices = async () => {
      setMarketFeed((current) => ({
        ...current,
        status: current.prices ? current.status : 'loading',
        refreshing: true,
        error: '',
      }))
      try {
        const prices = await getMarketPrices(MARKET_PRICE_SYMBOLS, controller.signal)
        if (controller.signal.aborted) return
        setMarketFeed({
          status: 'live',
          prices,
          updatedAt: Date.now(),
          refreshing: false,
          error: '',
        })
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        setMarketFeed((current) => ({
          ...current,
          status: current.prices ? 'stale' : 'error',
          refreshing: false,
          error: error instanceof Error ? error.message : 'Unable to load CoinGecko market prices.',
        }))
      }

      if (!controller.signal.aborted) {
        refreshTimer = window.setTimeout(() => void refreshPrices(), MARKET_PRICE_REFRESH_MS)
      }
    }

    void refreshPrices()
    return () => {
      controller.abort()
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    }
  }, [retryMarketLoad])

  useEffect(() => subscribeToMarketTicker({
    onStatus: (status) => setMarketStream((current) => ({ ...current, status })),
    onTicker: ({ price, receivedAt }) => setMarketStream((current) => ({
      ...current,
      price,
      updatedAt: receivedAt,
    })),
    onCandle: setMarketCandle,
  }, chartInterval), [chartInterval, retryMarketStream])

  useEffect(() => {
    if (apiStatus !== 'connected' || authLoading || !isAuthenticated || !user?.sub) return
    const requestSubject = user.sub
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      setOrdersLoading(true)
      setOrdersError('')
      const accessToken = await getAccessTokenSilently()
      if (!accessToken) throw new Error('Auth0 did not return an API access token.')
      return listOrders(accessToken, controller.signal)
    }).then((loadedOrders) => {
      if (!controller.signal.aborted) {
        setOrders(loadedOrders)
        setOrdersOwnerSubject(requestSubject)
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setOrdersError(error instanceof Error ? error.message : 'Unable to load orders.')
    }).finally(() => {
      if (!controller.signal.aborted) setOrdersLoading(false)
    })
    return () => controller.abort()
  }, [apiStatus, authLoading, getAccessTokenSilently, isAuthenticated, ordersRevision, user?.sub])

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
    if (isMarketPair(nextPair)) setTradingPair(nextPair)
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
    if (!isAuthenticated || authLoading) {
      setOrderError('Sign in with Auth0 before submitting an order.')
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
      const accessToken = await getAccessTokenSilently()
      if (!accessToken) throw new Error('Auth0 did not return an API access token.')
      const savedOrder = await createOrder({
        id: crypto.randomUUID(),
        trading_pair: tradingPair,
        side: orderSide,
        order_type: 'Limit',
        price,
        quantity,
      }, accessToken)
      setOrders((current) => [savedOrder, ...current.filter((item) => item.id !== savedOrder.id)])
      setOrdersOwnerSubject(user?.sub ?? null)
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
      const accessToken = await getAccessTokenSilently()
      if (!accessToken) throw new Error('Auth0 did not return an API access token.')
      const refreshedOrder = await getOrder(id, accessToken)
      setOrders((current) => current.map((item) => item.id === id ? refreshedOrder : item))
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to refresh this order.')
    } finally {
      setRefreshingOrderId('')
    }
  }

  const removeOrder = async (id: string) => {
    setCancellingOrderId(id)
    setOrdersError('')
    try {
      const accessToken = await getAccessTokenSilently()
      if (!accessToken) throw new Error('Auth0 did not return an API access token.')
      await cancelOrder(id, accessToken)
      setOrders((current) => current.map((item) => item.id === id ? { ...item, status: 'Cancelled' } : item))
      setOrdersOwnerSubject(user?.sub ?? null)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to cancel this order.')
    } finally {
      setCancellingOrderId('')
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
          <button
            className="wallet-button"
            type="button"
            disabled={authLoading}
            onClick={async () => {
              try {
                if (isAuthenticated) {
                  await logout({
                    logoutParams: { returnTo: window.location.origin },
                  });
                } else {
                  await loginWithRedirect();
                }
              } catch (error) {
                console.error("Auth0 login/logout failed:", error);
              }
            }}
          >
            <span className="status-dot" />
            {authLoading ? 'Loading…' : isAuthenticated ? 'Log out' : 'Log in'}
          </button>
          <button className="wallet-button" type="button" disabled title="Wallet integration is separate from application authentication"><span className="status-dot" />Wallet pending</button>
          <button className="icon-button menu-button" type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="primary-navigation">{mobileMenuOpen ? '×' : '☰'}</button>
        </div>
      </header>

      <div className={`backend-status ${apiStatus}`} role="status" aria-live="polite">
        <span className="status-dot" />
        <span>{apiStatus === 'loading' ? 'Connecting to token API · demo metadata shown until connected' : apiStatus === 'connected' ? 'Token API connected · metadata and balances are seeded, not wallet holdings' : 'Token API unavailable · demo metadata shown'}</span>
        {apiError && <span className="backend-status-error" title={apiError}>{apiError}</span>}
        {apiStatus === 'offline' && <button type="button" onClick={() => { setApiStatus('loading'); setApiError(''); setRetryTokenLoad((attempt) => attempt + 1) }}>Retry</button>}
      </div>
      <div className={`backend-status market-feed-status ${marketFeed.status}`} role="status" aria-live="polite">
        <span className="status-dot" />
        <span>{marketFeedMessage}</span>
        {marketFeed.error && <span className="backend-status-error" title={marketFeed.error}>{marketFeed.error}</span>}
        {(marketFeed.status === 'error' || marketFeed.status === 'stale') && <button type="button" onClick={() => setRetryMarketLoad((attempt) => attempt + 1)}>Retry prices</button>}
      </div>
      <div className={`backend-status market-stream-status ${marketStream.status}`} role="status" aria-live="polite">
        <span className="status-dot" />
        <span>{marketStreamMessage}</span>
        {marketStream.status === 'disconnected' && <button type="button" onClick={() => {
          setMarketStream((current) => ({ ...current, status: 'connecting' }))
          setRetryMarketStream((attempt) => attempt + 1)
        }}>Retry stream</button>}
      </div>

      <div className="page-content">
        <section className="trade-section" id="trade">
          <div className="page-heading trade-heading">
            <div><p className="eyebrow">DEXSYS TESTNET</p><h1>Trade</h1><p className="page-description">Limit-order trading workspace. Binance spot ticker and historical/live candles are market references; CoinGecko REST supplies USD references and 24-hour changes. Token metadata and sample balances are seeded.</p></div>
            <span className="environment-badge"><i /> TEST ENVIRONMENT</span>
          </div>

          <div className="market-summary">
            <div className="summary-pair">
              <span className="token-avatar">{baseToken.icon}</span>
              <div><strong>{tradingPair}</strong><small>Binance spot market data · {orderPairSupported ? 'order entry enabled' : 'unsupported pair'}</small></div>
              <select value={tradingPair} onChange={(event) => setTradingPair(event.target.value)} aria-label="Trading pair">
                {supportedPairs.map((pair) => <option key={pair} value={pair}>{pair}</option>)}
              </select>
            </div>
            <div className="summary-stat"><span>Pair spot price</span><strong>{pairPrice === null ? marketStream.status === 'connecting' ? 'Connecting…' : 'Unavailable' : `${formatPairPrice(pairPrice)} ${quoteSymbol}`}</strong></div>
            <div className="summary-stat"><span>24h change · USD references</span><strong className={pairChange === null ? '' : pairChange < 0 ? 'negative' : 'positive'}>{pairChange === null ? 'Unavailable' : `${pairChange >= 0 ? '+' : ''}${pairChange.toFixed(2)}%`}</strong></div>
            <div className="summary-stat"><span>24h volume</span><strong>Unavailable</strong></div>
          </div>

          <div className="terminal-grid">
            <section className="panel chart-panel" aria-label="Market chart and order book">
              <div className="chart-toolbar">
                <div className="chart-tabs" role="tablist" aria-label="Market data view">
                  {(['chart', 'depth', 'info'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={chartTab === tab} className={chartTab === tab ? 'selected' : ''} onClick={() => setChartTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
                </div>
                <div className="timeframes" role="group" aria-label="Chart interval">{MARKET_CANDLE_INTERVALS.map((interval) => <button key={interval} type="button" className={chartInterval === interval ? 'selected' : ''} aria-pressed={chartInterval === interval} onClick={() => {
                  setChartInterval(interval)
                  setMarketCandle(null)
                }}>{interval}</button>)}</div>
              </div>
              {chartTab === 'chart' && <Suspense fallback={<div className="chart-empty" role="status">Loading chart library…</div>}>
                <MarketChart
                  key={`${tradingPair}:${chartInterval}`}
                  pair={tradingPair === 'BTC/ETH' ? 'BTC/ETH' : 'ETH/BTC'}
                  interval={chartInterval}
                  liveUpdate={marketCandle}
                  connectionStatus={marketStream.status}
                  theme={theme}
                />
              </Suspense>}
              {chartTab === 'depth' && <OrderBookDepth key={tradingPair} pair={tradingPair} />}
              {chartTab === 'info' && <div className="chart-info">
                <span className="eyebrow">PAIR INFORMATION</span>
                <h2>{tradingPair}</h2>
                <p>Binance ETHBTC spot ticker and exchange kline data power the market chart; BTC/ETH displays the mathematically inverted ETHBTC prices. CoinGecko USD reference changes are separate from pair prices. Binance volume is not displayed or represented as DexSYS trading volume.</p>
                <div><span>Matching</span><strong>In-memory limit-order engine</strong></div>
                <div><span>Settlement</span><strong>Not connected to chain</strong></div>
              </div>}
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
                <div className="order-warning">Orders are associated with your Auth0 identity. Wallet connection remains separate; no balance check or settlement is performed.</div>
                {apiStatus !== 'connected' && <p className="feedback error" role="alert">Order entry is unavailable until the backend token API connects.</p>}
                {!authLoading && !isAuthenticated && <p className="feedback error" role="alert">Sign in with Auth0 to place orders.</p>}
                {!orderPairSupported && <p className="feedback error" role="alert">This pair is not supported by the order API.</p>}
                {orderError && <p className="feedback error" role="alert">{orderError}</p>}
                {orderSuccess && <p className="feedback success" role="status">{orderSuccess}</p>}
                <button className={`submit-order ${orderSide === 'Sell' ? 'sell-action' : ''}`} type="submit" disabled={orderSubmitting || authLoading || !isAuthenticated || apiStatus !== 'connected' || !orderPairSupported}>{orderSubmitting ? 'Submitting order…' : `${orderSide} ${tradingPair}`}</button>
                <p className="form-footnote">Market orders are unsupported. API response is authoritative for order status.</p>
              </form> : <div className="open-orders-panel">
                <div className="panel-heading compact"><div><h2>Open orders</h2><p>Persisted backend records</p></div><button className="text-button" type="button" onClick={reloadOrders} disabled={ordersLoading}>Refresh</button></div>
                {ordersLoading && isAuthenticated && <p className="empty-state" role="status">Loading persisted orders…</p>}
                {ordersError && <p className="feedback error" role="alert">{ordersError}</p>}
                {!ordersLoading && !ordersError && apiStatus === 'connected' && isAuthenticated && openOrders.length === 0 && <p className="empty-state">No open orders.</p>}
                {!ordersLoading && isAuthenticated && visibleOrders.length > 0 && openOrders.slice(0, 8).map((order) => <OrderRow key={order.id} order={order} onRefresh={refreshOrder} onCancel={removeOrder} refreshing={refreshingOrderId === order.id} cancelling={cancellingOrderId === order.id} compact />)}
                {!isAuthenticated && !authLoading && <p className="empty-state">Sign in to view your order history.</p>}
                {apiStatus !== 'connected' && <p className="empty-state">Backend order history requires an API connection.</p>}
                <a className="all-orders-link" href="#activity" onClick={() => setActiveSection('activity')}>View all activity <span>→</span></a>
              </div>}
            </aside>
          </div>
        </section>

        <section className="content-section" id="markets">
          <SectionHeading eyebrow="MARKETS" title="Token markets" description="CoinGecko USD prices and 24-hour changes; DexSYS token metadata and sample balances remain seeded. Pair-level volume is not available." />
          <div className="market-controls">
            <label className="search-control"><span aria-hidden="true">⌕</span><input value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} placeholder="Search tokens" aria-label="Search tokens" /></label>
            <div className="filter-control" role="group" aria-label="Market sort">
              <button type="button" className={marketFilter === 'all' ? 'selected' : ''} onClick={() => setMarketFilter('all')}>All assets</button>
              <button type="button" className={marketFilter === 'movers' ? 'selected' : ''} onClick={() => setMarketFilter('movers')}>Largest moves</button>
            </div>
          </div>
          <div className="table-scroll">
            <div className="data-table market-table">
              <div className="table-header market-columns"><span>ASSET / PAIRS</span><span>USD PRICE</span><span>24H CHANGE</span><span>VOLUME</span><span /></div>
              {visibleMarkets.map((item) => <button className="table-row market-columns" key={item.symbol} type="button" onClick={() => selectToken(item.symbol)}>
                <span className="asset-cell"><i className="token-avatar">{item.icon}</i><span><strong>{item.name}</strong><small>{item.symbol} · {item.pairs.join(', ') || 'No supported pairs returned'}</small></span></span>
                <strong>{item.price}</strong><span className={changeTone(item.change)}>{item.change}</span><span className="muted">Not provided</span><span className="trade-link">Select <b>→</b></span>
              </button>)}
              {visibleMarkets.length === 0 && <p className="empty-state">No assets match that search.</p>}
            </div>
          </div>
          <p className="section-footnote">Prices and 24-hour changes are from CoinGecko when the feed is live; otherwise shown values are seeded/demo fallbacks. All balances are sample values, never connected wallet holdings. Volume is not provided.</p>
        </section>

        <section className="content-section" id="activity">
          <SectionHeading eyebrow="ACCOUNT ACTIVITY" title="Order history" description="Persisted order records returned by the DexSYS API. No sample trades are shown as user activity." />
          <div className="activity-toolbar">
            <div className="filter-control" role="tablist" aria-label="Filter order status">
              {activityFilters.map((filter) => <button type="button" role="tab" aria-selected={activityFilter === filter} className={activityFilter === filter ? 'selected' : ''} key={filter} onClick={() => setActivityFilter(filter)}>{filter}</button>)}
            </div>
            <div className="activity-source"><span className={`source-dot ${apiStatus === 'connected' ? 'active' : ''}`} />{apiStatus === 'connected' ? 'LIVE API RECORDS' : 'API UNAVAILABLE'}<button className="text-button" type="button" disabled={apiStatus !== 'connected' || !isAuthenticated || authLoading || ordersLoading} onClick={reloadOrders}>{ordersLoading ? 'Loading…' : 'Refresh'}</button></div>
          </div>
          {ordersError && <p className="feedback error" role="alert">{ordersError}</p>}
          {apiStatus !== 'connected' && <div className="state-panel"><strong>Order history unavailable</strong><p>Connect to the backend to read persisted orders. Demo trades are intentionally excluded.</p></div>}
          {apiStatus === 'connected' && !authLoading && !isAuthenticated && <div className="state-panel"><strong>Sign in to view order history</strong><p>Only orders associated with your Auth0 identity are available here.</p></div>}
          {apiStatus === 'connected' && authLoading && <div className="state-panel" role="status"><strong>Checking sign-in state</strong><p>Waiting for Auth0 authentication…</p></div>}
          {apiStatus === 'connected' && isAuthenticated && ordersLoading && <div className="state-panel" role="status"><strong>Loading order history</strong><p>Fetching persisted orders from the DexSYS API…</p></div>}
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
              <div className="protocol-fields"><span>USD price</span><strong>{item.price}</strong><span>24h change</span><strong className={changeTone(item.change)}>{item.change}</strong><span>Sample balance</span><strong>{item.balance.toLocaleString()} {item.symbol} <small>· not a wallet balance</small></strong><span>Contract / identifier</span><code>{item.address || 'Not provided'}</code></div>
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

function OrderRow({ order, onRefresh, onCancel, refreshing, cancelling, compact = false }: {
  order: Order
  onRefresh: (id: string) => void
  onCancel: (id: string) => void
  refreshing: boolean
  cancelling: boolean
  compact?: boolean
}) {
  return <div className={`open-order-row ${compact ? 'compact' : ''}`}>
    <div><strong>{order.trading_pair}</strong><span className={order.side === 'Buy' ? 'positive' : 'negative'}>{order.side} · {order.quantity} {order.order_type}</span></div>
    <div><strong>{order.price ?? '—'}</strong><StatusBadge status={order.status} /></div>
    <button className="text-button" type="button" onClick={() => onRefresh(order.id)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
    {order.status === 'Pending' && <button className="text-button" type="button" onClick={() => onCancel(order.id)} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel'}</button>}
  </div>
}

function StatusBadge({ status }: { status: Order['status'] | 'Pending' }) {
  const tone = status === 'Filled' ? 'filled' : status === 'Cancelled' ? 'cancelled' : 'open'
  return <span className={`status-badge ${tone}`}>{status}</span>
}

export default App

import { useEffect, useState } from 'react'
import { getOrderBookDepth, type DepthLevel, type OrderBookDepth as DepthData } from '../services/orderBookService'
import './OrderBookDepth.css'

const DEPTH_REFRESH_MS = 2_500
const DEPTH_STALE_MS = 10_000
const CHART_WIDTH = 720
const CHART_HEIGHT = 220
const CHART_PADDING = { top: 16, right: 18, bottom: 32, left: 54 }

type DepthState = {
  data: DepthData | null
  fetchedAt: number | null
  error: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 }).format(value)
}

function formatAge(age: number) {
  return age < 1_000 ? 'just now' : `${Math.floor(age / 1_000)}s ago`
}

function depthPath(levels: DepthLevel[], reverse: boolean, x: (price: number) => number, y: (quantity: number) => number) {
  const ordered = reverse ? [...levels].reverse() : levels
  if (ordered.length === 0) return ''
  const first = ordered[0]
  const firstX = x(Number(first.price))
  let path = `M ${firstX} ${y(Number(first.cumulative_quantity))}`
  let previousY = y(Number(first.cumulative_quantity))
  for (const level of ordered.slice(1)) {
    const nextX = x(Number(level.price))
    const nextY = y(Number(level.cumulative_quantity))
    path += ` L ${nextX} ${previousY} L ${nextX} ${nextY}`
    previousY = nextY
  }
  return `${path} L ${x(Number(ordered[ordered.length - 1].price))} ${CHART_HEIGHT - CHART_PADDING.bottom} L ${firstX} ${CHART_HEIGHT - CHART_PADDING.bottom} Z`
}

function DepthChart({ depth }: { depth: DepthData }) {
  const prices = [...depth.bids, ...depth.asks].map((level) => Number(level.price))
  const quantities = [...depth.bids, ...depth.asks].map((level) => Number(level.cumulative_quantity))
  if (prices.length === 0) return null
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const spread = high - low || low * 0.01 || 1
  const minPrice = low - spread * 0.04
  const maxPrice = high + spread * 0.04
  const maxQuantity = Math.max(...quantities)
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const x = (price: number) => CHART_PADDING.left + ((price - minPrice) / (maxPrice - minPrice)) * plotWidth
  const y = (quantity: number) => CHART_PADDING.top + plotHeight - (quantity / maxQuantity) * plotHeight
  const bidPath = depthPath(depth.bids, true, x, y)
  const askPath = depthPath(depth.asks, false, x, y)
  const midpoint = (minPrice + maxPrice) / 2

  return (
    <div className="depth-chart-wrap">
      <div className="depth-chart-legend"><span className="depth-bid-key">BIDS</span><span className="depth-ask-key">ASKS</span><span>CUMULATIVE BASE QUANTITY</span></div>
      <svg className="depth-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${depth.trading_pair} cumulative local order-book depth`}>
        {[0, 0.5, 1].map((fraction) => {
          const gridY = CHART_PADDING.top + plotHeight * (1 - fraction)
          return <g key={fraction}>
            <line x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={gridY} y2={gridY} className="depth-grid-line" />
            <text x={CHART_PADDING.left - 8} y={gridY + 4} textAnchor="end" className="depth-axis-label">{formatNumber(maxQuantity * fraction)}</text>
          </g>
        })}
        <line x1={x(midpoint)} x2={x(midpoint)} y1={CHART_PADDING.top} y2={CHART_HEIGHT - CHART_PADDING.bottom} className="depth-midpoint-line" />
        {bidPath && <path d={bidPath} className="depth-bid-area" />}
        {askPath && <path d={askPath} className="depth-ask-area" />}
        <text x={CHART_PADDING.left} y={CHART_HEIGHT - 8} textAnchor="start" className="depth-axis-label">{formatNumber(minPrice)}</text>
        <text x={CHART_WIDTH - CHART_PADDING.right} y={CHART_HEIGHT - 8} textAnchor="end" className="depth-axis-label">{formatNumber(maxPrice)}</text>
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" className="depth-axis-label">PRICE ({depth.trading_pair.split('/')[1]})</text>
      </svg>
    </div>
  )
}

function DepthSideTable({ side, levels, baseSymbol, quoteSymbol }: {
  side: 'Bids' | 'Asks'
  levels: DepthLevel[]
  baseSymbol: string
  quoteSymbol: string
}) {
  return (
    <div className={`depth-side depth-side-${side.toLowerCase()}`}>
      <h3>{side}</h3>
      <div className="depth-table-scroll">
        <table>
          <thead><tr><th>Price <span>({quoteSymbol})</span></th><th>Size <span>({baseSymbol})</span></th><th>Total <span>({baseSymbol})</span></th></tr></thead>
          <tbody>{levels.map((level, index) => <tr key={`${level.price}-${index}`}>
            <td>{level.price}</td><td>{level.quantity}</td><td>{level.cumulative_quantity}</td>
          </tr>)}</tbody>
        </table>
        {levels.length === 0 && <p className="depth-side-empty">No resting {side.toLowerCase()}.</p>}
      </div>
    </div>
  )
}

export default function OrderBookDepth({ pair }: { pair: string }) {
  const [state, setState] = useState<DepthState>({ data: null, fetchedAt: null, error: '' })
  const [now, setNow] = useState(Date.now())
  const [retry, setRetry] = useState(0)
  const [baseSymbol, quoteSymbol] = pair.split('/')

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined

    const refresh = async () => {
      try {
        const data = await getOrderBookDepth(pair, controller.signal)
        if (controller.signal.aborted) return
        setState({ data, fetchedAt: Date.now(), error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Unable to load the DexSYS order book.',
        }))
      }
      if (!controller.signal.aborted) timer = window.setTimeout(() => void refresh(), DEPTH_REFRESH_MS)
    }

    void refresh()
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [pair, retry])

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    const timer = window.setInterval(updateNow, 1_000)
    document.addEventListener('visibilitychange', updateNow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [])

  const stale = state.fetchedAt !== null && now - state.fetchedAt >= DEPTH_STALE_MS
  const status = state.data === null
    ? state.error ? 'UNAVAILABLE' : 'LOADING'
    : stale || state.error ? 'STALE' : 'POLLING'
  const depth = state.data
  const age = state.fetchedAt === null ? null : Math.max(0, now - state.fetchedAt)

  return (
    <section className="orderbook-depth" aria-label={`${pair} DexSYS order-book depth`}>
      <header className="depth-heading">
        <div><h2>{pair} depth</h2><p>DexSYS matching-engine book · polled every 2.5 seconds</p></div>
        <span className={`depth-status ${status.toLowerCase()}`} role={status === 'UNAVAILABLE' ? 'alert' : 'status'}>
          <i />{status}
        </span>
      </header>
      {depth && <div className="depth-update-note">
        <span>LOCAL LIMIT-ORDER LIQUIDITY · NOT BINANCE DEPTH</span>
        {age !== null && <span>Last successful poll {formatAge(age)}</span>}
      </div>}
      {status === 'LOADING' && <div className="depth-message" role="status"><strong>Loading DexSYS depth</strong><span>Reading resting orders from the local matching engine…</span></div>}
      {status === 'UNAVAILABLE' && <div className="depth-message error" role="alert">
        <strong>DexSYS depth unavailable</strong><span>{state.error}</span>
        <button type="button" onClick={() => setRetry((count) => count + 1)}>Retry</button>
      </div>}
      {depth && state.error && <p className="depth-warning" role="status">Latest poll failed: {state.error}. The last successful snapshot is shown as stale.</p>}
      {depth && stale && !state.error && <p className="depth-warning" role="status">No successful depth refresh for at least 10 seconds. Displayed levels may be stale.</p>}
      {depth && depth.bids.length === 0 && depth.asks.length === 0
        ? <div className="depth-message"><strong>No resting orders</strong><span>The DexSYS book is empty for {pair}. No external liquidity or sample levels are shown.</span></div>
        : depth && <>
          <DepthChart depth={depth} />
          <div className="depth-sides">
            <DepthSideTable side="Bids" levels={depth.bids} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} />
            <DepthSideTable side="Asks" levels={depth.asks} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} />
          </div>
        </>}
    </section>
  )
}

# DexSYS frontend

React 19, TypeScript, and Vite browser application for the DexSYS off-chain order prototype.

## Local development

From `frontend/`, install and run:

```sh
npm ci
npm run dev
```

The Vite server normally serves `http://localhost:5173` and proxies `/api/*` to `http://127.0.0.1:8080`, stripping `/api`. Start PostgreSQL and the Rust API separately; see [`../docs/getting-started.md`](../docs/getting-started.md).

Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` in local `.env`. Auth0's allowed callback, logout, and web origins must include the frontend origin. The audience must match backend configuration. Never put a client secret in `VITE_*`; these variables are exposed to the browser. Optional API variables are `VITE_API_BASE_URL` (default `/api`) and `DEXSYS_API_PROXY_TARGET` (default `http://127.0.0.1:8080`).

## Implemented behavior and boundaries

- Auth0 sign-in for user-scoped API order actions; this is not wallet connection.
- Token metadata fetch for seeded ETH/BTC, with explicitly labelled demo fallback/reference values.
- Limit-order entry, own order listing/get/refresh/cancel through the backend.
- Binance public ETHBTC spot ticker and exchange candlesticks for ETH/BTC and reciprocal BTC/ETH charts; CoinGecko USD reference prices and 24-hour changes remain separate.
- Search/filter, activity and protocol metadata views.
- The chart fetches up to 500 historical candles from Binance `GET /api/v3/klines` and receives current candles over the shared Binance combined ticker/kline WebSocket. Supported chart intervals are 1m, 5m, and 15m. The chart does not show exchange volume or DexSYS execution prices.
- The Depth tab polls the public `GET /market/depth/{base}/{quote}` endpoint every 2.5 seconds while selected. It displays fixed-point-aggregated resting levels from the local DexSYS matching engine, with cumulative depth chart and bid/ask tables; empty books remain empty, and stale/unavailable states are explicit. It is polling, not a WebSocket feed.
- No market-order submission, wallet balance verification, on-chain settlement, Binance order-book data, or DexSYS trade volume. A backend `Filled` status is not an on-chain trade.

See [`../docs/02-design/trading-interface.md`](../docs/02-design/trading-interface.md) and [`../docs/03-api/websocket.md`](../docs/03-api/websocket.md).

## Verify the live chart

From `frontend/`, run `npm ci` and `npm run dev`, then open `http://localhost:5173`. Configure the Auth0 values described above so the trade page is available. Start the Rust API and PostgreSQL for DexSYS depth; select ETH/BTC or BTC/ETH and choose the Depth tab. The chart remains backed by public Binance market data, separate from the local DexSYS order book.

## Checks

```sh
npm test
npm run lint
npm run build
```

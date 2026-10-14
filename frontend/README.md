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
- Binance public ETHBTC spot stream (BTC/ETH shown as reciprocal); CoinGecko USD reference prices and 24-hour changes.
- Search/filter, activity and protocol metadata views.
- No market-order submission, wallet balance verification, on-chain settlement, live book depth, volume, or historical price chart. A backend `Filled` status is not an on-chain trade.

See [`../docs/02-design/trading-interface.md`](../docs/02-design/trading-interface.md) and [`../docs/03-api/websocket.md`](../docs/03-api/websocket.md).

## Checks

```sh
npm test
npm run lint
npm run build
```

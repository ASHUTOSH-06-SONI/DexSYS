# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # DexSYS Frontend

  Responsive React and TypeScript exchange prototype for the DexSYS project.

  ## Run locally

  Requirements: Node.js and npm versions supported by the Vite version in `package.json`.

  ```sh
  npm ci
  npm run dev
  ```

  Vite serves the frontend on its default port (normally `5173`). The development proxy forwards `/api/*` to the Rust API at `http://127.0.0.1:8080` and removes the `/api` prefix. Start the backend separately from `backend/` with `cargo run -p api`.

  Configure `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` for the Auth0 SPA and API. Set the audience to `https://api.dexsys.local`. The SPA callback and logout URLs use the current origin (normally `http://localhost:5173` locally); add that origin to the Auth0 application's Allowed Callback URLs, Allowed Logout URLs, and Allowed Web Origins. The Auth0 client ID and audience are public configuration; never put an Auth0 client secret in the frontend.

  `VITE_API_BASE_URL` is the browser-visible API base and defaults to `/api`. `DEXSYS_API_PROXY_TARGET` changes the Vite development proxy target. Do not put credentials or secrets in `VITE_*` variables; they are shipped to the browser.

  For a deployed frontend, route the configured API base through a same-origin reverse proxy unless the API explicitly enables and configures CORS. The Rust API currently binds to `127.0.0.1:8080` and has no CORS middleware.

  ## Frontend structure

  - `src/App.tsx` composes the exchange views and owns local navigation, selection, filtering, theme, and API loading state.
  - `src/components/TokenInput.tsx` is the shared pay/receive input and selector.
  - `src/data/demoData.ts` contains clearly identified representative fallback tokens and sample activity.
  - `src/services/apiClient.ts` handles JSON requests, HTTP errors, network failures, and response parsing.
  - `src/services/tokenService.ts` validates and maps the Rust token response into the UI token type.
  - `src/services/marketDataService.ts` loads public USD spot prices and 24-hour changes from CoinGecko.
  - `src/domain/swapQuote.ts` calculates a local indicative quote from displayed prices. It does not submit an order.
  - `src/types.ts` contains shared frontend view types.

  Theme preference is stored in `localStorage`. Trade selection, filters, amounts, and API request state stay in React component state; there is no global state library or API cache.

  ## Token and price data

  The frontend uses the existing `GET /tokens/{symbol}` route for DexSYS token metadata. There is no token-list or market-list endpoint, so it requests the two symbols seeded by the backend: `ETH` and `BTC`. The endpoint's `price`, `change_24h`, and `balance` values are seeded demo values, not live market quotes or wallet balances.

  Successful responses have this shape:

  ```json
  {
    "symbol": "ETH",
    "name": "Ethereum",
    "validated": true,
    "price": 3500.0,
    "change_24h": 2.4,
    "balance": 1.25,
    "contract_address": "0x...",
    "supported_pairs": ["USDC", "WBTC"]
  }
  ```

  Unknown symbols return HTTP `404` with `{"error":"Token Not Found"}`. The client validates response fields and displays loading, connected, or unavailable states. If the request fails or the response is malformed, it visibly identifies the representative demo data and provides a retry action; it does not describe fallback data as backend data.

  Current USD prices and 24-hour changes come from CoinGecko's public `/api/v3/simple/price` endpoint, mapped for ETH, BTC, USDC, and WBTC. The frontend refreshes every 60 seconds, displays loading/error states, retains the last successful quote as stale when a refresh fails, and exposes a retry action. CoinGecko is a separate market-data source; a live spot USD conversion for the selected pair is calculated from those token prices, not supplied by the DexSYS matching API.

  Static/demo-only surfaces are intentionally distinct: `src/data/demoData.ts` contains fallback prices and sample balances used when token metadata cannot load; backend token prices and balances are seeded in `backend/crates/api/src/repository.rs`; and `src/domain/orderBook.ts` contains a hard-coded demo order-book fixture that is not rendered as live depth. The UI labels fallback prices, sample balances, and unavailable volume/history/order-book data. The DexSYS API still has no token-list route, market history, quote endpoint, order-book endpoint, or WebSocket market feed.

  ## Other backend contracts

  The API also defines these order routes. They require an Auth0 access token for the DexSYS API in `Authorization: Bearer ...`; ID tokens are not used as API credentials.

  | Method | Route | Contract |
  | --- | --- | --- |
  | `GET` | `/orders` | JSON array of `Order` records |
  | `POST` | `/orders` | JSON order fields and response; the server derives the owner from the verified Auth0 principal and sets status to `Pending` |
  | `GET` | `/orders/{id}` | JSON `Order` record |
  | `DELETE` | `/orders/{id}` | `204 No Content` on success |

  An order response contains `id`, server-assigned `user_id`, `trading_pair`, `side` (`Buy`/`Sell`), `order_type` (`Limit`/`Market`), nullable `price`, `quantity`, and `status` (`Pending`/`Filled`/`Cancelled`). Listing, retrieval, and cancellation are restricted to the authenticated principal; another user's order is returned as not found (`404`). Legacy orders have no trusted principal mapping and are not automatically assigned. Wallet connectivity and SIWE remain separate from application authentication.

  The backend requires `AUTH0_DOMAIN` (tenant hostname without scheme/path) and optionally accepts `AUTH0_AUDIENCE` (defaults to `https://api.dexsys.local`). It validates RS256 signatures against cached Auth0 JWKS, issuer, audience, and expiry. No client secret is required.

  The `orderbook`, `matching-engine`, and `shared` Rust crates currently contain no implementation, and the API exposes no orderbook route. No fabricated orderbook is rendered. Wallet, portfolio, and blockchain transaction integrations are also pending.

  ## Current status

  ### Implemented

  - Responsive exchange UI, persistent light/dark theme, market selection/search/filtering, and sample activity views.
  - Token metadata loading from the existing Rust token route for its currently seeded symbols.
  - Explicit token API loading/error states and labeled representative demo fallback.
  - CoinGecko spot USD prices and 24-hour changes with periodic refresh, stale-data handling, and provider error/retry states.
  - Local quote calculation and review preview only.

  ### Backend integration pending

  - Token listing, pair-specific executable quotes, historical chart data, authenticated user portfolio, and persistent order history.
  - Full order matching lifecycle and settlement integrations.
  - Orderbook API and matching-engine implementation.

  ### Blockchain integration pending

  - Wallet provider, signing, chain/network checks, settlement contracts, and transaction confirmation.

  ## Checks

  ```sh
  npm run test
  npm run lint
  npm run build
  ```
### New Feature

The project now includes an improved user interface demonstration.
## Development Update

This update demonstrates feature branch development using Git.
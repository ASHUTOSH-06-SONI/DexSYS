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

  Copy `.env.example` to `.env` only when local overrides are needed. `VITE_API_BASE_URL` is the browser-visible API base and defaults to `/api`. `DEXSYS_API_PROXY_TARGET` changes the Vite development proxy target. Do not put credentials or secrets in `VITE_*` variables; they are shipped to the browser.

  For a deployed frontend, route the configured API base through a same-origin reverse proxy unless the API explicitly enables and configures CORS. The Rust API currently binds to `127.0.0.1:8080` and has no CORS middleware.

  ## Frontend structure

  - `src/App.tsx` composes the exchange views and owns local navigation, selection, filtering, theme, and API loading state.
  - `src/components/TokenInput.tsx` is the shared pay/receive input and selector.
  - `src/data/demoData.ts` contains clearly identified representative fallback tokens and sample activity.
  - `src/services/apiClient.ts` handles JSON requests, HTTP errors, network failures, and response parsing.
  - `src/services/tokenService.ts` validates and maps the Rust token response into the UI token type.
  - `src/domain/swapQuote.ts` calculates a local indicative quote from displayed prices. It does not submit an order.
  - `src/types.ts` contains shared frontend view types.

  Theme preference is stored in `localStorage`. Trade selection, filters, amounts, and API request state stay in React component state; there is no global state library or API cache.

  ## Token API integration

  The only implemented market-data endpoint is `GET /tokens/{symbol}`. There is no token-list or market-list endpoint, so the frontend requests the two symbols currently seeded in `backend/crates/api/src/state.rs`: `ETH` and `BTC`.

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

  The current Rust `AppState` seeds these response values in memory. They are not live market prices or wallet balances. The API has no token-list route, market history, quote endpoint, or WebSocket market feed.

  ## Other backend contracts

  The API also defines these order routes, but the UI does not call them:

  | Method | Route | Contract |
  | --- | --- | --- |
  | `GET` | `/orders` | JSON array of `Order` records |
  | `POST` | `/orders` | JSON `Order` request and response; the server validates it and sets status to `Pending` |
  | `GET` | `/orders/{id}` | JSON `Order` record |
  | `DELETE` | `/orders/{id}` | `204 No Content` on success |

  An order contains `id`, `user_id`, `trading_pair`, `side` (`Buy`/`Sell`), `order_type` (`Limit`/`Market`), nullable `price`, `quantity`, and `status` (`Pending`/`Filled`/`Cancelled`). Errors are JSON `{ "error": "..." }`: not found (`404`), invalid order (`400`), or duplicate ID (`409`). Orders are held in process memory. There is no authentication or user identity integration, so sample activity remains explicitly separate and order submission is not exposed by the frontend.

  The `orderbook`, `matching-engine`, and `shared` Rust crates currently contain no implementation, and the API exposes no orderbook route. No fabricated orderbook is rendered. Wallet, portfolio, and blockchain transaction integrations are also pending.

  ## Current status

  ### Implemented

  - Responsive exchange UI, persistent light/dark theme, market selection/search/filtering, and sample activity views.
  - Token metadata loading from the existing Rust token route for its currently seeded symbols.
  - Explicit API loading/error states and labeled representative demo fallback.
  - Local quote calculation and review preview only.

  ### Backend integration pending

  - Token listing, live market/quote/history feeds, authenticated user portfolio, and persistent order history.
  - Order submission/cancellation UI after authentication, ownership, and lifecycle contracts are defined.
  - Orderbook API and matching-engine implementation.

  ### Blockchain integration pending

  - Wallet provider, signing, chain/network checks, settlement contracts, and transaction confirmation.

  ## Checks

  ```sh
  npm run test
  npm run lint
  npm run build
  ```

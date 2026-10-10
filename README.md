# DexSYS

DexSYS is a decentralized exchange (DEX) prototype built as a full-stack project with a Rust API backend, a React + TypeScript trading interface, and a Solidity/Hardhat contract workspace. The project currently focuses on a testnet-ready exchange preview: seeded token metadata is exposed via the backend, the frontend presents a responsive trading UI, and the core DEX engine components are scaffolded for future exchange execution.

## Project status

Current implementation highlights:

- Rust Axum backend serving health, PostgreSQL-backed token metadata, and order endpoints
- SQLx migrations and PostgreSQL repositories for tokens, trading pairs, orders, trades, settlements, and audit events
- React/Vite frontend that renders a token swap workspace, price cards, and activity views
- Seeded token data for ETH and BTC with fallback demo values when the API is unavailable
- Orderbook and matching-engine crates in Rust as a foundation for future execution logic
- Solidity contract workspace prepared for a future settlement layer

Current gaps:

- No wallet connection or authentication
- No live blockchain settlement or order execution
- No real market data feed, orderbook feed, or WebSocket stream
- No production-grade auth/user flows
- Orderbook/matching logic remains partially scaffolded and not yet wired into the API

## Architecture overview

The repository is organized into four main areas:

- `backend/` — Rust workspace containing the Axum API and supporting crates
- `frontend/` — React + TypeScript trading interface
- `contracts/` — Solidity/Hardhat wallet and settlement foundation
- `docs/` — project requirements, design, API docs, and deployment notes

## Tech stack

Backend:

- Rust
- Axum web framework
- Tokio async runtime
- PostgreSQL with SQLx
- Serde for JSON serialization
- Cargo workspace with multiple crates

Frontend:

- React 19
- TypeScript
- Vite
- Vitest and ESLint

Contracts:

- Solidity
- Hardhat 3
- viem

## Repository layout

```text
DexSYS/
├── backend/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── config/
│   ├── crates/
│   │   ├── api/
│   │   ├── matching-engine/
│   │   ├── orderbook/
│   │   └── shared/
│   ├── docker/
│   ├── examples/
│   ├── migrations/
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example
│   ├── index.html
│   └── src/
├── contracts/
│   ├── package.json
│   ├── hardhat.config.ts
│   └── ...
├── docs/
│   ├── 01-requirements/
│   ├── 02-design/
│   ├── 03-api/
│   ├── 04-testing/
│   ├── 05-deployment/
│   └── adr/
├── LICENSE
├── README.md
└── .gitignore
```

## Backend

The backend lives in `backend/` as a Cargo workspace. The workspace includes:

- `crates/api` — HTTP API entrypoint and routes
- `crates/orderbook` — orderbook data structure and order handling
- `crates/matching-engine` — execution logic foundation
- `crates/shared` — shared data models (order side, order type, order schema)

### Backend architecture

The API is written with Axum and shares a SQLx PostgreSQL pool through its application state. The server currently binds to `127.0.0.1:8080`.

Core backend components:

- `AppState` shares the PostgreSQL pool used by token and order repositories
- SQLx migrations apply automatically during API startup; demo ETH/BTC token and pair rows are inserted only when absent
- `/health` and `/` return API service health information
- `/tokens/{symbol}` returns persistent token metadata for ETH and BTC
- `/orders` supports list/create operations
- `/orders/{id}` supports get/cancel operations
- Order submission serializes access to a per-trading-pair in-memory matching engine
- Pending limit orders are restored from PostgreSQL into the in-memory orderbooks at startup
- Persisted order priority sequence preserves FIFO order when a price level is restored
- Trades are persisted only from executions returned by `MatchingEngine::process_order`
- Market-order submission is rejected because the existing engine dereferences a limit price and does not implement market-order behavior

### Current backend data model

Token response shape:

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

Order payload shape:

```json
{
  "id": "order-123",
  "user_id": "alice",
  "trading_pair": "ETH/BTC",
  "side": "Buy",
  "order_type": "Limit",
  "price": 3500.0,
  "quantity": 1.5,
  "status": "Pending"
}
```

### Backend routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | Health endpoint |
| GET | `/health` | Health endpoint |
| GET | `/tokens/{symbol}` | Fetch token metadata |
| GET | `/orders` | List persisted orders |
| POST | `/orders` | Create order |
| GET | `/orders/{id}` | Fetch one order |
| DELETE | `/orders/{id}` | Cancel order |

### Backend behavior

The current backend behaves like a lightweight exchange prototype with persistent API records:

- ETH/BTC token metadata and the ETH/BTC plus BTC/ETH pairs are initialized in PostgreSQL only when absent
- Missing tokens return `404` with `{ "error": "Token Not Found" }`
- Invalid orders return `400` with `{ "error": "Invalid Order" }`
- Duplicate orders return `409` with `{ "error": "Order Already Exists" }`
- Orders require an active and approved persisted trading pair
- Cancellation persists `Cancelled` for pending orders; invalid transitions return `409`
- Database failures return `500`; they are not reported as successful empty results

See [PostgreSQL local development](#postgresql-local-development) for database setup and backend run instructions.

The server starts on:

```text
http://127.0.0.1:8080
```

## Frontend

The frontend is a React + TypeScript application created with Vite. It provides a DEX trading UI shell designed around an exchange workflow: market search, swap preview, token detail panel, and order activity.

### Frontend features

- Responsive trading layout
- Dark/light theme persisted with `localStorage`
- Token list and market selection logic
- Swap preview with local quote calculation
- API-driven token info loading from the backend
- Graceful fallback to representative demo data when API requests fail
- Explicit connection status messages for backend availability

### Frontend architecture

The main frontend files are:

- `frontend/src/App.tsx` — main trading interface and state management
- `frontend/src/components/TokenInput.tsx` — interactive token selection amount input
- `frontend/src/services/apiClient.ts` — Fetch wrapper with validation and error handling
- `frontend/src/services/tokenService.ts` — Maps backend token data into frontend token view models
- `frontend/src/data/demoData.ts` — Demo market and activity data
- `frontend/src/domain/swapQuote.ts` — Local indicative quote calculation
- `frontend/src/types.ts` — Shared TypeScript DTOs for tokens and recent trades

### Frontend environment and proxy

The frontend uses Vite proxy configuration in `frontend/vite.config.ts`:

- `/api` is proxied to `http://127.0.0.1:8080`
- This allows the browser to call `/api/...` without CORS issues during local development

The frontend uses these environment variables:

```env
VITE_API_BASE_URL=/api
DEXSYS_API_PROXY_TARGET=http://127.0.0.1:8080
```

The example config is in `frontend/.env.example`.

### Frontend run instructions

From the repository root:

```bash
cd frontend
npm install
cp -n .env.example .env
npm run dev
```

The dev server usually runs on:

```text
http://localhost:5173
```

### Frontend testing and validation

```bash
cd frontend
npm run test
npm run lint
npm run build
```

## Contracts

The `contracts/` directory is a Hardhat 3 project for Solidity-based DEX settlement and blockchain integration work. The project currently includes a Hardhat configuration targeting a simulated mainnet and OP chain, plus the packaging required for future on-chain contract development.

Settlement vault integration added to the project.

### Contract project run instructions

```bash
cd contracts
npm install
npx hardhat test
```

## Current implementation reality

The repository is best understood as an exchange prototype with the following boundaries:

- The backend exposes token and order endpoints, but not a real market or liquidity engine
- The frontend renders an exchange interface, but it does not submit transactions or connect a wallet
- The orderbook and matching-engine crates are foundational, but not fully integrated into the API
- The smart contract project is ready for future settlement work, but not yet connected to real user flows

## Recommended local development flow

1. Start the Rust API:

```bash
cd backend
cargo run -p api
```

2. Start the frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

3. Open the app in the browser and verify the token metadata loads from `/api/tokens/ETH` and `/api/tokens/BTC`.

4. Use the frontend demo fallback to confirm the UI still renders correctly if the backend is offline.

5. Extend the backend and contract layers as market execution, user auth, and settlement workflows are added.

## API contract summary

### Token info

```http
GET /tokens/{symbol}
```

Returns a token record for `ETH` or `BTC` initialized in PostgreSQL without overwriting existing token metadata.

### Health

```http
GET /health
```

Returns service metadata and status.

### Orders

```http
GET /orders
POST /orders
GET /orders/{id}
DELETE /orders/{id}
```

These endpoints preserve the existing order request/response shape while reading and writing PostgreSQL. Cancellation is limited to pending orders.

### PostgreSQL local development

Start the local PostgreSQL service (for Homebrew, use the installed PostgreSQL formula):

```bash
brew services start postgresql
createdb dexsys
```

Copy the safe example configuration and run the API from any working directory. The API resolves the repository-root `.env`, applies embedded SQLx migrations at startup, and never prints the database URL:

```bash
cp .env.example .env
cargo run --manifest-path backend/Cargo.toml -p api
```

The example `DATABASE_URL` is `postgresql://localhost/dexsys`. Migrations are applied by the application; installing `sqlx-cli` is not required.

The database stores prices and quantities as `NUMERIC(38,18)`. API order prices are expressed in quote-token units per base-token unit, and quantities in base-token units. Matching uses checked fixed-point conversion: 100 engine price ticks per API price unit (0.01 price increments) and 1,000,000 engine quantity units per API quantity unit (0.000001 quantity increments). Values that are not exactly representable at those scales or exceed `i64` bounds are rejected; there is no rounding. Engine execution integers convert back to exact decimal strings for PostgreSQL `NUMERIC` writes. Existing API JSON remains numeric (`f64`), and database values that cannot round-trip through that contract are rejected when retrieved.

Each matching engine is in memory and scoped to one pair so the existing engine cannot cross-match orders from different pairs. API submissions and cancellations are serialized through shared state. Submission executes against a staged engine clone; the order, maker/taker remainders, actual trades, and audit rows are written in one PostgreSQL transaction, and the live engine is replaced only after commit. This prevents a failed database write from mutating that API process's live orderbook.

PostgreSQL still cannot be transactionally atomic with in-memory matching or blockchain operations. There is no durable execution outbox/recovery protocol, and open orders are restored but prior trades are not replayed into matching. Settlement status is application bookkeeping only and is not proof of on-chain confirmation.

### Backend tests

Create a dedicated test database; do not point the persistence integration test at a development database. The test requires the database name to end in `_test` and does not delete test data:

```bash
createdb dexsys_test
DEXSYS_TEST_DATABASE_URL=postgresql:///dexsys_test \
  cargo test --manifest-path backend/Cargo.toml -p api --test persistence -- --ignored
cargo test --manifest-path backend/Cargo.toml --workspace
```

## Roadmap and future work

Planned evolution for the project includes:

- Authenticated users and wallet connection
- A persistent matching-engine execution integration and recovery/reconciliation flow
- Real market data, historical price feeds, and WebSocket updates
- Smart contract settlement, approvals, and token flows
- Production-grade security, observability, and deployment pipeline

## Documentation

Additional design and requirement notes live under `docs/` and include:

- Requirements and user stories
- Design documents and architecture notes
- API references
- Testing strategy and deployment guidance

## License

This repository is licensed under the MIT-style license declared in `LICENSE`.

## Summary

DexSYS is a full-stack DEX prototype designed to demonstrate the shape of a decentralized exchange system across backend, frontend, and smart-contract layers. It is currently a polished preview of the exchange experience, backed by a Rust API and a React trading interface, while the underlying execution, wallet, and settlement systems remain under active construction.

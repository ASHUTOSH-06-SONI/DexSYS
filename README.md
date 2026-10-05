# DexSYS

DexSYS is a decentralized exchange (DEX) prototype built as a full-stack project with a Rust API backend, a React + TypeScript trading interface, and a Solidity/Hardhat contract workspace. The project currently focuses on a testnet-ready exchange preview: seeded token metadata is exposed via the backend, the frontend presents a responsive trading UI, and the core DEX engine components are scaffolded for future exchange execution.

This repository is intentionally a working prototype rather than a production-grade exchange. It demonstrates API contracts, front-end UX patterns, and the beginning of the matching-engine and orderbook layers that will support a live DEX once wallet, settlement, and on-chain logic are integrated.

## Project status

Current implementation highlights:

- Rust Axum backend serving health, token metadata, and in-memory order endpoints
- React/Vite frontend that renders a token swap workspace, price cards, and activity views
- Seeded token data for ETH and BTC with fallback demo values when the API is unavailable
- Orderbook and matching-engine crates in Rust as a foundation for future execution logic
- Solidity contract workspace prepared for a future settlement layer

Current gaps:

- No wallet connection or authentication
- No live blockchain settlement or order execution
- No real market data feed, orderbook feed, or WebSocket stream
- No persisted database layer or production-grade auth/user flows
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

The API is written with Axum and exposes an in-memory application state. The server currently binds to `127.0.0.1:8080` and provides a simple stateful service for demo data.

Core backend components:

- `AppState` stores seeded tokens and in-memory orders in `RwLock<HashMap<...>>`
- `/health` and `/` return API service health information
- `/tokens/{symbol}` returns token metadata for ETH and BTC
- `/orders` supports list/create operations
- `/orders/{id}` supports get/cancel operations

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
  "trading_pair": "ETH/USDC",
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
| GET | `/orders` | List in-memory orders |
| POST | `/orders` | Create order |
| GET | `/orders/{id}` | Fetch one order |
| DELETE | `/orders/{id}` | Cancel order |

### Backend behavior

The current backend behaves like a lightweight exchange prototype:

- Token metadata is seeded directly in `AppState::new()`
- Missing tokens return `404` with `{ "error": "Token Not Found" }`
- Invalid orders return `400` with `{ "error": "Invalid Order" }`
- Duplicate orders return `409` with `{ "error": "Order Already Exists" }`
- Order cancellation marks the item as `Cancelled` without persisting it beyond memory

### Backend run instructions

From the repository root:

```bash
cd backend
cargo run -p api
```

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
cp .env.example .env
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

The current project is not yet connected to the Rust backend or the frontend UI. It is intended to host the settlement layer when the DEX moves beyond the prototype phase.

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

Returns a token record for `ETH` or `BTC` that matches the seeded in-memory data.

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

These endpoints provide a basic in-memory order lifecycle used to prototype the exchange API contract.

## Roadmap and future work

Planned evolution for the project includes:

- Persistent order storage with a real database
- Authenticated users and wallet connection
- A live orderbook and matching engine integration
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

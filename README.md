# DexSYS

DexSYS is an academic software-engineering MVP demonstrating a browser trading interface, an Auth0-scoped Rust order API, PostgreSQL persistence, an in-process limit-order matcher, external reference market data, and a separately tested Solidity vault.

> **Important status:** The order-book prototype works as an off-chain matching and persistence demonstration. It is **not an on-chain-settled exchange**. `SettlementVault` has standalone Hardhat tests, but is not integrated with frontend/API orders. Deployment is future work; only local development commands are documented and testable.

## Current implementation status

| Capability | Status |
|---|---|
| Rust Axum health and individual token metadata endpoints | Implemented; token metadata is seeded/reference data |
| Auth0 access-token validation and user-scoped orders | Implemented for order routes |
| ETH/BTC and BTC/ETH limit-order entry, matching, persistence and cancel | Implemented as a local off-chain prototype; engine state is in-process |
| ETHBTC market spot ticker and reciprocal BTC/ETH display | Implemented via public Binance WebSocket |
| ETH/BTC and reciprocal BTC/ETH candlestick chart | Implemented with Binance historical klines and live kline stream; 1m, 5m, and 15m |
| USD references and 24-hour changes | Implemented via public CoinGecko REST |
| Native ETH `SettlementVault` deposit/withdrawal | Implemented/tested standalone; no app integration |
| Wallet connect/signing, wallet balance, balance reservation, on-chain trade settlement | Not implemented |
| Read-only DexSYS resting order-book depth | Implemented via public polling endpoint; local in-memory matching-engine levels only |
| AMM, trade-history API, DexSYS trading volume | Not implemented |
| Production deployment, Docker/Compose, CI/CD | Not configured |

See the [SRS](./docs/01-requirements/SRS.md) and [functional requirements/traceability](./docs/01-requirements/functional-requirements.md) for the as-built boundary.

## Architecture

```text
Browser (React/Vite)
  ├── Vite /api proxy ──> Rust Axum API (127.0.0.1:8080)
  │                         ├── PostgreSQL (SQLx migrations/repositories)
  │                         └── per-pair in-memory matching engine + read-only depth snapshots
  ├── Auth0 SPA / access token (orders only)
  ├── Binance public ETHBTC WebSocket (combined spot ticker + selected kline interval)
  ├── Binance public REST klines (candlestick history; reciprocal BTC/ETH display)
  └── CoinGecko public REST (USD reference prices)

Hardhat/Solidity SettlementVault ── standalone; not connected to order flow
```

Order records and matcher-produced executions are persisted. A `Filled` status is an off-chain matcher result, not proof of token transfer or chain settlement. Only pending limit orders are rebuilt into in-memory books at startup; past executions are not replayed into matching state. See [system architecture](./docs/02-design/system-architecture.md) and [database design](./docs/02-design/database-design.md).

## Repository layout

```text
.
├── backend/
│   ├── crates/
│   │   ├── api/                 # Axum routes, auth, persistence, matching integration
│   │   ├── matching-engine/     # limit matching
│   │   ├── orderbook/           # price levels and FIFO queues
│   │   └── shared/              # engine order types
│   └── migrations/              # PostgreSQL schema and ownership/priority changes
├── frontend/
│   ├── src/App.tsx              # trading UI
│   ├── src/components/          # responsive Lightweight Charts candlestick chart
│   ├── src/services/            # API, Auth0-backed orders, Binance, CoinGecko
│   └── src/domain/              # view/domain helpers and tests
├── contracts/
│   ├── contracts/core/SettlementVault.sol
│   └── test/SettlementVault.ts
└── docs/
    ├── 01-requirements/
    ├── 02-design/
    ├── 03-api/
    ├── 04-testing/
    ├── 05-deployment/
    └── adr/
```

There is no checked-in deployment infrastructure, container definition, workflow, or submission screenshot/evidence asset.

## Prerequisites and quick start

Use native Rust/Cargo, Node.js/npm, and PostgreSQL; Docker Desktop is not required. Configure local PostgreSQL and Auth0 as described in [getting started](./docs/getting-started.md).

From repository root, create/edit `.env` with `DATABASE_URL`, `AUTH0_DOMAIN`, `CORS_ALLOWED_ORIGINS` (exact comma-separated frontend origins), and optionally `AUTH0_AUDIENCE`, then start:

```sh
cargo run --manifest-path backend/Cargo.toml -p api
```

In a second terminal, create/edit `frontend/.env` with `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` (optional `VITE_API_BASE_URL` and `DEXSYS_API_PROXY_TARGET`), then:

```sh
cd frontend
npm ci
npm run dev
```

Default API audience: `https://api.dexsys.local`. The Vite dev proxy maps browser `/api/...` to backend routes. Read [usage](./docs/usage.md) for the limit-order demonstration and [troubleshooting](./docs/troubleshooting.md) for common setup errors. No secrets belong in source or `VITE_*` variables.

## Development and validation commands

```sh
# Run each command from repository root
(cd frontend && npm ci && npm test && npm run lint && npm run build)
cargo test --manifest-path backend/Cargo.toml --workspace

# Optional PostgreSQL integration tests; dedicated, isolated _test database only
createdb dexsys_test
DEXSYS_TEST_DATABASE_URL=postgresql://localhost/dexsys_test \
  cargo test --manifest-path backend/Cargo.toml -p api --test persistence -- --ignored

# Standalone Solidity contract (local Hardhat network)
(cd contracts && npm ci && npm test && npx hardhat build)
```

The frontend chart and DexSYS depth view are verified locally by running `cd frontend && npm ci && npm run dev` and opening `http://localhost:5173` with Auth0 configured; run the Rust API and PostgreSQL separately. Candles use public Binance data; the depth tab polls the local engine through `GET /market/depth/{base}/{quote}` every 2.5 seconds. Depth is not Binance liquidity or DexSYS trade volume. The four ignored database cases write uniquely named rows and do not clean them up. Do not point them at a development/shared database. Full prerequisites and test scope are in the [test plan](./docs/04-testing/test-plan.md); no coverage percentage is published because no coverage report is configured.

## Documentation index

- **Requirements:** [SRS](./docs/01-requirements/SRS.md) · [functional requirements and traceability](./docs/01-requirements/functional-requirements.md) · [non-functional requirements](./docs/01-requirements/non-functional-requirements.md) · [user stories](./docs/01-requirements/user-stories.md) · [use cases](./docs/01-requirements/use-cases.md) · [glossary](./docs/01-requirements/glossary.md)
- **Design:** [system architecture](./docs/02-design/system-architecture.md) · [components](./docs/02-design/component-diagram.md) · [class view](./docs/02-design/class-diagram.md) · [database](./docs/02-design/database-design.md) · [deployment topology](./docs/02-design/deployment-diagram.md) · [sequences](./docs/02-design/sequence-diagrams.md) · [states](./docs/02-design/state-diagrams.md) · [token information](./docs/02-design/token-information.md) · [trading interface](./docs/02-design/trading-interface.md)
- **API:** [authentication](./docs/03-api/authentication.md) · [errors](./docs/03-api/error-codes.md) · [orders](./docs/03-api/orders.md) · [HTTP route/trade inventory](./docs/03-api/trades.md) · [wallet/settlement boundary](./docs/03-api/wallet.md) · [external WebSocket market data](./docs/03-api/websocket.md)
- **Testing:** [plan and commands](./docs/04-testing/test-plan.md) · [strategy](./docs/04-testing/test-strategy.md) · [test cases](./docs/04-testing/test-cases.md) · [coverage status](./docs/04-testing/coverage.md)
- **Deployment:** [environment](./docs/05-deployment/environment.md) · [container status](./docs/05-deployment/docker.md) · [CI/CD status](./docs/05-deployment/ci-cd.md) · [future deployment guide](./docs/05-deployment/deployment-guide.md)
- **Decisions:** [ADR template](./docs/adr/000-template.md) · [architecture](./docs/adr/001-project-architecture.md) · [Rust API](./docs/adr/002-rust-backend.md) · [off-chain orderbook](./docs/adr/003-off-chain-orderbook.md) · [standalone vault boundary](./docs/adr/004-smart-contract-settlement.md)
- **Practical guides:** [getting started](./docs/getting-started.md) · [usage](./docs/usage.md) · [troubleshooting](./docs/troubleshooting.md)

The ADRs are reconstructed from source; inferred rationale is labelled and not presented as recorded historical discussion.

## Security and academic MVP boundaries

- Auth0 issuer/subject identifies order owners; it is not wallet verification.
- The backend has no wallet signing, custody, balance checking/reservation, or contract settlement.
- The matcher is in-process and not safe to scale across replicas without a shared execution/recovery design.
- Database `settlements` structures do not indicate a running settlement worker or chain confirmation.
- External market values and seeded metadata are not liquidity guarantees.
- This repository is not a production exchange; no deployment or complete security verification is claimed.

For the contract's standalone scope and tests see [`contracts/README.md`](./contracts/README.md). No demo screenshots or deployed submission evidence are currently checked in.

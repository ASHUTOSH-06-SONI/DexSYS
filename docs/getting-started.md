# Getting started

These instructions are for native local development from a clone of the repository root. Docker Desktop is not required or configured.

## Prerequisites

- Git; Rust stable with Cargo (edition 2024 toolchain, Rust 1.85 or later).
- Node.js compatible with the repository's Vite 8 and Hardhat 3 dependencies (Node 22 LTS is a practical choice) and npm.
- PostgreSQL installed and running locally for API/token/order persistence.
- An Auth0 SPA application and API configured for local sign-in/order workflows. Public health/token reads do not require a user token, but API startup still requires Auth0 tenant configuration.
- Internet access for downloading npm/Cargo dependencies and for optional CoinGecko/Binance feeds.

## 1. Create local database and backend environment

From repository root:

```sh
createdb dexsys
cp -n .env.example .env
```

Edit the root `.env` with:

```dotenv
DATABASE_URL=postgresql://localhost/dexsys
AUTH0_DOMAIN=your-tenant.example.auth0.com
AUTH0_AUDIENCE=https://api.dexsys.local
```

Use your actual Auth0 tenant hostname. Do not include `https://` or a path in `AUTH0_DOMAIN`; `AUTH0_AUDIENCE` must match the Auth0 API and frontend. `.env.example` only contains `DATABASE_URL`; Auth0 values must be supplied locally. Never commit `.env`.

Start the API in terminal 1, from repository root:

```sh
cargo run --manifest-path backend/Cargo.toml -p api
```

On startup it connects to PostgreSQL, applies migrations, inserts missing demo metadata/pairs, restores pending limit orders, and listens at `http://127.0.0.1:8080`. Confirm with `curl http://127.0.0.1:8080/health`.

## 2. Configure and start the frontend

In terminal 2, from repository root:

```sh
cp -n frontend/.env.example frontend/.env
```

Edit `frontend/.env` and set:

```dotenv
VITE_AUTH0_DOMAIN=your-tenant.example.auth0.com
VITE_AUTH0_CLIENT_ID=your-public-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.dexsys.local
VITE_API_BASE_URL=/api
DEXSYS_API_PROXY_TARGET=http://127.0.0.1:8080
```

Add the local browser origin (normally `http://localhost:5173`) to the Auth0 SPA's allowed callback, logout, and web origins. Configure the Auth0 API audience to match `VITE_AUTH0_AUDIENCE` and backend `AUTH0_AUDIENCE`. Client ID/domain/audience are public configuration, not secrets; never add a client secret to `VITE_*`.

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The dev proxy rewrites `/api/...` to the API path; no backend `/api` prefix is registered. The frontend blocks on-screen Auth0 setup when required SPA values are missing.

## 3. Contract tests (optional)

In a third terminal:

```sh
cd contracts
npm ci
npm test
npx hardhat build
```

These commands use local simulated networks; no wallet, RPC URL, or private key is required for the tests. See [contract test documentation](../contracts/README.md).

## 4. Test commands

From repository root:

```sh
(cd frontend && npm test && npm run lint && npm run build)
cargo test --manifest-path backend/Cargo.toml --workspace
(cd contracts && npm test && npx hardhat build)
```

The four PostgreSQL integration cases are ignored by default and require an isolated database ending in `_test`; see the [test plan](./04-testing/test-plan.md). Do not point them at `dexsys` or any shared database.

## Local network summary

| Component | Local address |
|---|---|
| Vite browser app | Usually `http://localhost:5173` |
| Rust API | `http://127.0.0.1:8080` |
| PostgreSQL | Local configured PostgreSQL service/connection |
| Binance combined stream | `wss://stream.binance.com:9443/stream?streams=ethbtc@ticker/ethbtc@kline_1m` (the selected interval replaces `1m`) |
| Binance historical klines | `https://api.binance.com/api/v3/klines` |
| CoinGecko REST | `https://api.coingecko.com/api/v3/simple/price` |

For supported behavior and important limits see [usage](./usage.md), [environment variables](./05-deployment/environment.md), and [troubleshooting](./troubleshooting.md).

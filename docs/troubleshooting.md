# Troubleshooting

## API exits before listening

- Confirm PostgreSQL is running and `DATABASE_URL` points to a reachable database.
- Ensure root `.env` exists (the API resolves it from the repository root) and has `AUTH0_DOMAIN` set to a hostname without `https://` or path.
- Ensure `AUTH0_AUDIENCE` matches the API audience configured in Auth0; if omitted, backend default is `https://api.dexsys.local`.
- API automatically applies migrations and seeds missing sample tokens/pairs. Existing seeded rows are not overwritten.

## Frontend shows Auth0 configuration required

Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` in `frontend/.env`, then restart Vite. In Auth0, allow the exact local origin for callback, logout and web origin, and configure API audience. Do not use a client secret in the browser environment.

## Frontend cannot reach API / Vite proxy errors

Start the Rust service on `127.0.0.1:8080`; the default Vite proxy target is that address. If the API runs elsewhere, set `DEXSYS_API_PROXY_TARGET` before starting Vite. The proxy strips `/api`, so direct Axum routes are `/health`, `/tokens/ETH`, and `/orders`, not `/api/...`.

## Order API returns `401` or `503`

`401` indicates missing/invalid access token, issuer, audience, expiry, or signature. Verify that the SPA requests an **access token** for the same API audience that the backend validates; Auth0 ID tokens are not API credentials. `503 Authentication service unavailable` indicates JWKS could not be fetched/parsed; check tenant domain/network availability.

## `400 Invalid Order`

Check positive finite quantity/price, non-empty ID/pair, and `Limit` type. The UI uses supported `ETH/BTC` or `BTC/ETH`; the backend also requires the pair to be seeded active/approved. Price must be a multiple of 0.01 and quantity of 0.000001 after exact conversion; no rounding is applied. No balance check is performed.

## `404` for an order

The order may not exist or may belong to another Auth0 issuer/subject. Both cases deliberately return not found; legacy records without a principal mapping are not automatically assigned.

## `409` on create or cancel

A duplicate client order ID conflicts. The frontend generates a UUID for ordinary submissions. A cancellation conflict means the owned order is no longer pending.

## Market-data status is stale/unavailable

CoinGecko REST and Binance WebSocket are external and need network access. Use the visible retry controls. Binance retries are bounded; after exhaustion use Retry stream. A retained quote marked stale is not a current price or matching-engine value.

## PostgreSQL integration test refuses URL or fails

Set `DEXSYS_TEST_DATABASE_URL` to a separate PostgreSQL database whose name ends in `_test`, e.g. `postgresql://localhost/dexsys_test`. The ignored test applies migrations and creates uniquely named rows; it does not clean those rows. Never use the development or a shared database.

## No Docker setup

The repository has no Dockerfile/Compose workflow. Install/use PostgreSQL natively; Docker Desktop is not needed for local development.

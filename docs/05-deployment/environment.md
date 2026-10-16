# Environment configuration

Environment names are taken from the current source and checked-in safe examples. Keep credentials local; do not commit `.env` files, Auth0 secrets, private keys, or funded RPC credentials.

## Repository-root `.env` (backend)

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Root `.env.example` contains `postgresql://localhost/dexsys`. |
| `AUTH0_DOMAIN` | Yes at API startup | Auth0 tenant hostname only, e.g. `tenant.example.auth0.com` (no `https://` or path). |
| `AUTH0_AUDIENCE` | No | API audience; backend default is `https://api.dexsys.local`. Must match the Auth0 API and frontend value. |
| `CORS_ALLOWED_ORIGINS` | Yes at API startup | Comma-separated exact HTTP(S) frontend origins, e.g. `https://dexsys.netlify.app,https://trade.example.com`. Do not include paths or use `*`. |

The API loads `.env` from repository root if present, migrates the database, seeds missing records, and binds to `0.0.0.0:$PORT` (`8080` when `PORT` is missing or blank). CORS allows only the origins in `CORS_ALLOWED_ORIGINS`; set local development origins such as `http://localhost:5173` explicitly when needed. Preflight OPTIONS requests are handled by the CORS layer before route authentication.

## `frontend/.env`

| Variable | Required | Meaning |
|---|---|---|
| `VITE_AUTH0_DOMAIN` | Yes for application UI | Auth0 tenant domain. |
| `VITE_AUTH0_CLIENT_ID` | Yes | Public SPA client ID; not a client secret. |
| `VITE_AUTH0_AUDIENCE` | Yes | API audience requested for access token; match backend. |
| `VITE_API_BASE_URL` | No | Browser API prefix; defaults to `/api`. |
| `DEXSYS_API_PROXY_TARGET` | No | Vite dev proxy target; defaults to `http://127.0.0.1:8080`. |

The tracked `frontend/.env.example` only sets the API base and proxy target. Add Auth0 values locally, then configure that SPA's allowed callback, logout and web origins to the local origin, usually `http://localhost:5173`. Never put secrets in `VITE_*`; these values are shipped to the browser.

## Contract network configuration

Hardhat config declares local simulated `hardhatMainnet`/`hardhatOp` networks and a Sepolia HTTP network that reads `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` through Hardhat configuration variables. These support tool configuration only; no deployment module/run is present or verified. Do not configure a funded key for routine tests.
# Deployment topology and current status

## Verified local development topology

```mermaid
flowchart LR
  Browser[Browser :5173]
  Vite[Vite dev server]
  API[Rust API 127.0.0.1:8080]
  DB[(Local PostgreSQL)]
  Auth0[Configured Auth0 tenant]
  CG[CoinGecko public HTTPS]
  BN[Binance public WSS]
  Browser --> Vite
  Vite -->|/api rewrite to API paths| API
  API --> DB
  Browser -->|OAuth redirect / API token| Auth0
  API -->|JWKS validation| Auth0
  Browser --> CG
  Browser --> BN
```

The frontend's Vite proxy removes the `/api` prefix. The API binds to loopback and has no CORS middleware. PostgreSQL migrations and non-destructive demo seed inserts run when the API starts.

## Planned deployment shape (not configured or tested)

```mermaid
flowchart LR
  User[Browser] -->|HTTPS| Proxy[Future same-origin TLS reverse proxy]
  Proxy -->|static SPA| Static[Future static frontend host]
  Proxy -->|/api| Service[Future private API service]
  Service --> DB[(Future managed PostgreSQL)]
  Service -. future external JWKS validation .-> Auth0[Auth0]
  User -. direct provider connections as needed .-> Market[Binance / CoinGecko]
```

Every component in the lower diagram is a planning illustration, not repository infrastructure. There is no Dockerfile/Compose, Terraform, deployment manifest, checked-in CI workflow, or recorded deployed environment. See [deployment guide](../05-deployment/deployment-guide.md).
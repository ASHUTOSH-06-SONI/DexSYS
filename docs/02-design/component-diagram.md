# Component diagram

Solid edges are implemented calls/data flows. Dotted edges explicitly mark non-integration.

```mermaid
flowchart TB
  subgraph Browser["Browser (React/Vite)"]
    UI[Trade, markets, activity, protocol views]
    AuthSDK[Auth0 React SDK]
    ApiClient[API client and DTO validation]
    MarketData[Binance ticker and kline service]
    Prices[CoinGecko price service]
  end
  subgraph Backend["Rust API process"]
    Routes[Axum health/token/order routes]
    Verify[Auth0 JWT/JWKS authenticator]
    Repos[SQLx repositories and migrations]
    State[AppState: PostgreSQL pool + pair engines]
    Matcher[matching-engine]
    Book[orderbook]
  end
  DB[(PostgreSQL)]
  AuthProvider[Auth0]
  BinanceWS[Binance ETHBTC ticker and kline WebSocket]
  BinanceREST[Binance ETHBTC historical klines REST]
  CoinGecko[CoinGecko simple/price]
  Vault[SettlementVault]
  UI --> AuthSDK
  UI --> ApiClient
  ApiClient --> Routes
  Routes --> Verify
  Verify --> AuthProvider
  Routes --> Repos
  Repos --> DB
  Routes --> State
  State --> Matcher --> Book
  UI --> MarketData --> BinanceWS
  UI -->|historical candles| BinanceREST
  UI --> Prices --> CoinGecko
  Matcher -. persisted execution record only; no chain transfer .-> Vault
```

The backend API does not expose orderbook or trade query endpoints. The vault component is shown to identify the boundary, not a runtime dependency.
# Usage

This guide describes the existing browser MVP, not a deployed exchange.

## Inspect market information

Open the Trade area to see the selected pair, Binance spot status, CoinGecko USD references and 24-hour changes. Available order pairs are **ETH/BTC** and **BTC/ETH**. The latter display is the reciprocal of Binance's ETHBTC last-price tick. Token metadata and sample balances are seeded reference values; they are not holdings.

Chart history, live depth, volume, live orderbook visualization, and wallet connection/balances are unavailable. The interface labels those states rather than inventing data.

## Submit a limit order

1. Sign in with the configured Auth0 SPA. Auth0 identity is distinct from a wallet.
2. Select `ETH/BTC` or `BTC/ETH`.
3. Choose Buy or Sell and enter a positive base-token quantity and positive limit price (quote-token units per base-token unit).
4. Submit. The browser generates an order ID and sends the order with an API-audience access token. Caller identity is derived server-side.
5. The Rust matcher may execute against crossing opposite orders in the same pair or rest an unfilled remainder. The API response/status is authoritative.

The engine uses 0.01 price increments and 0.000001 quantity increments. Values must be exactly representable; the API rejects values requiring rounding. Market orders are unsupported. There is no balance check, reservation, or blockchain settlement. An order status of `Filled` means the prototype matcher exhausted the amount, not that assets moved on-chain.

## View, refresh, filter, cancel

Use the Orders panel or Activity section to view only the signed-in identity's persisted orders. Refresh reads the API again. Cancel is available for pending orders and updates the backend; a filled/cancelled order cannot be cancelled again. Owner checks happen on the server, not just in the UI.

The current API response contains original order quantity and status, but not remaining quantity, executed quantity, or creation time; the UI displays unavailable fields as such. There is no public trade-history endpoint.

## Standalone vault

`SettlementVault` can be exercised only through a local Hardhat simulated chain in this repository. Its ETH balance functions are not called by this UI/API. There is no working app deposit, withdrawal, wallet signing, token approval, or trade settlement flow.

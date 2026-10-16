# Trading interface

## Views and controls

The React application in `frontend/src/App.tsx` provides section navigation for Trade, Markets, Activity, and Protocol; a dark/light theme preference; pair summary; chart/depth/info tabs; an order-entry/open-orders panel; searchable token-market rows; authenticated order history; and token protocol metadata. The chart uses TradingView Lightweight Charts with Binance spot klines for `ETH/BTC` and reciprocal `BTC/ETH`, with 1m, 5m, and 15m intervals. The Depth tab polls the public DexSYS depth endpoint every 2.5 seconds while selected and renders a cumulative chart plus bid/ask tables from the matching engine's own resting orders.

The order form accepts `Buy` or `Sell`, a positive base quantity, and a positive limit price in quote units per base unit. It supports only `ETH/BTC` and `BTC/ETH`. The displayed pair tick comes from Binance's public ETHBTC stream; chart history comes from Binance's public kline REST endpoint and live updates from the combined ticker/kline stream. CoinGecko USD references and 24-hour changes are separate from pair prices and candles. Chart data is external market reference data, not DexSYS execution prices. Depth is local DexSYS liquidity—not Binance depth or trade volume—and levels are aggregated with integer fixed-point quantities before decimal serialization. The API reads a brief snapshot under the same mutex used for matching and cancellation; it exposes no mutable engine internals.

## Authentication and ownership

Auth0 login authenticates an application identity; it does not connect a wallet. The API associates each created order with a verified issuer/subject principal. The client obtains an access token for the configured API audience. History and cancellation are scoped server-side.

## Order limitations shown in the UI

- Market orders are unsupported.
- No balance verification/reservation occurs.
- A successfully matched order is not settled on a chain.
- Displayed token balances/metadata are seeded sample data.
- DexSYS depth is an in-memory snapshot of resting limit orders; it is not a WebSocket stream, trade history, or settlement record. Empty and stale/unavailable states are shown honestly. DexSYS trading volume, creation time, filled/remaining quantities from an API response, and wallet positions are unavailable. Binance candle volume is not displayed as DexSYS volume.

Responsive breakpoints and visual behavior are defined in `frontend/src/App.css` and `frontend/src/components/MarketChart.css`; presentation details are not a substitute for an accessibility audit.

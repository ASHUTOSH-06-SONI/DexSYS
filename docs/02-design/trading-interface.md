# Trading interface

## Views and controls

The React application in `frontend/src/App.tsx` provides section navigation for Trade, Markets, Activity, and Protocol; a dark/light theme preference; pair summary; chart/depth/info tabs; an order-entry/open-orders panel; searchable token-market rows; authenticated order history; and token protocol metadata. The depth tab and historical intervals are disabled/unavailable.

The order form accepts `Buy` or `Sell`, a positive base quantity, and a positive limit price in quote units per base unit. It supports only `ETH/BTC` and `BTC/ETH`. The displayed pair tick comes from Binance's public ETHBTC stream; CoinGecko USD references and 24-hour changes are separate. The API decides order status.

## Authentication and ownership

Auth0 login authenticates an application identity; it does not connect a wallet. The API associates each created order with a verified issuer/subject principal. The client obtains an access token for the configured API audience. History and cancellation are scoped server-side.

## Order limitations shown in the UI

- Market orders are unsupported.
- No balance verification/reservation occurs.
- A successfully matched order is not settled on a chain.
- Displayed token balances/metadata are seeded sample data.
- Historical charts, book depth, volume, creation time, filled/remaining quantities from an API response, and wallet positions are unavailable.

Responsive breakpoints and visual behavior are defined in `frontend/src/App.css`; presentation details are not a substitute for an accessibility audit.

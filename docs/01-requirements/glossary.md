# Glossary

| Term | Meaning in this repository |
|---|---|
| API | Rust Axum HTTP service under `backend/crates/api`. |
| Auth0 principal | Identity tuple of verified JWT issuer and subject; not a wallet address. |
| Base / quote | In a pair `BASE/QUOTE`, price is quote units per base unit; quantity is base units. |
| Demo/reference value | Seeded metadata or fallback display value; not a connected wallet holding or verified chain value. |
| Execution / trade row | A price-crossing quantity produced by the in-memory matcher and persisted to PostgreSQL. It is not on-chain settlement. |
| Fixed-point scale | API price × 100 and API quantity × 1,000,000, exactly, to form engine `i64`s. |
| Limit order | A buy/sell with a positive limit price. It can match crossing orders and rest as a remainder. |
| Matching engine | In-process, per-pair Rust engine backed by the `orderbook` crate. Not a distributed matching service. |
| Pending | Order has positive remaining quantity, including a partially matched order. |
| SettlementVault | Standalone Solidity contract holding native ETH balances; not connected to order/trade records. |
| Stale quote | Previously received provider data retained after an update/connection problem and identified as stale. |
| Supported pair | Currently seeded API pairs `ETH/BTC` and `BTC/ETH`. |
| Wallet | Not integrated. Auth0 sign-in must not be described as wallet connectivity or signing. |
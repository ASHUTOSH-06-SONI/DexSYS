# Functional requirements and traceability

**Baseline:** Source on `main`, inspected 14 October 2026.
**Status convention:** `Implemented` means code exists in this repository, not production readiness; `Partial` means only the stated subset exists; `Not implemented` is not an MVP acceptance requirement.

## MVP requirements

| ID | Requirement and acceptance summary | Status | Implementation evidence | Automated evidence |
|---|---|---|---|---|
| FR-01 | Health endpoints return service name, version, and status. | Implemented | `backend/crates/api/src/routes/health.rs` | `cargo test --manifest-path backend/Cargo.toml --workspace` |
| FR-02 | Public token lookup returns metadata for a persisted symbol or a not-found error. | Implemented | `backend/crates/api/src/routes/token.rs`, `token.rs`, repository seed | `backend/crates/api/tests/persistence.rs` (ignored DB integration cases) |
| FR-03 | Orders routes require a valid Auth0 RS256 bearer access token for the configured issuer and audience. | Implemented | `backend/crates/api/src/auth.rs`, `routes/mod.rs` | Auth middleware tests in `auth.rs`; unauthenticated routes in `tests/persistence.rs` |
| FR-04 | Create an order for an active, approved registered pair, deriving ownership from the verified principal rather than caller-supplied identity. | Implemented | `routes/order.rs`, `order.rs`, `repository.rs` | Ignored PostgreSQL API lifecycle test |
| FR-05 | Accept only valid positive finite order values; execute only limit orders, with price and quantity exactly representable at 0.01 and 0.000001 increments. | Implemented | `matching.rs`, `order.rs` | Numeric/matching unit tests; API lifecycle test |
| FR-06 | Match price-crossing orders by price priority and FIFO within a price level; store only matcher-produced executions. | Implemented | `matching-engine/src/lib.rs`, `orderbook/src/lib.rs`, API `matching.rs` | `cargo test --manifest-path backend/Cargo.toml --workspace`; lifecycle test |
| FR-07 | Persist incoming order, maker/taker remaining quantities/status, executions, and related audit rows in a PostgreSQL transaction before publishing the staged engine state. | Implemented | `crates/api/src/matching.rs`, `repository.rs` | Ignored PostgreSQL persistence/lifecycle test |
| FR-08 | Authenticated users list/read/cancel only their own orders. Cross-user lookup is indistinguishable from missing (`404`); only pending orders can be cancelled. | Implemented | `routes/order.rs`, owner-scoped repository queries | Auth tests and ignored PostgreSQL integration cases |
| FR-09 | Restore persisted pending limit orders into per-pair in-memory books at API startup, preserving stored FIFO priority. | Implemented | `state.rs`, `matching.rs`, migration `20261010000200_add_order_priority_sequence.up.sql` | Ignored PostgreSQL integration cases |
| FR-10 | Display supported-pair order entry, authenticated order history, cancellation, market selection/search, and explicit unavailable states. | Implemented | `frontend/src/App.tsx`, `services/orderService.ts`, `domain/orderActivity.ts` | `frontend/src/services/orderService.test.ts`, `frontend/src/domain/orderActivity.test.ts`, manual browser verification |
| FR-11 | Show Binance ETHBTC last-price ticks and reciprocal BTC/ETH display; expose connection/stale state and bounded reconnect/manual retry. | Implemented | `frontend/src/services/marketTickerService.ts`, `App.tsx` | `marketTickerService.test.ts`; browser/network manual verification |
| FR-12 | Show CoinGecko USD references and 24-hour change, refreshing on the configured interval with loading/error/stale handling. | Implemented | `frontend/src/services/marketDataService.ts`, `App.tsx` | `marketDataService.test.ts`; provider availability is external |
| FR-13 | Display seeded token metadata/balances only as reference/demo values; do not imply connected-wallet holdings. | Implemented | API `repository.rs`, `frontend/src/data/demoData.ts`, `App.tsx` | `tokenService.test.ts`; manual UI verification |
| FR-14 | `SettlementVault` permits its caller to deposit positive native ETH and withdraw up to their recorded balance; failed recipient transfer reverts accounting. | Implemented, standalone | `contracts/contracts/core/SettlementVault.sol` | Six tests in `contracts/test/SettlementVault.ts` |
| FR-15 | Keep wallet signing, balance validation, blockchain settlement, depth streaming, and DexSYS trade volume unavailable; identify external chart data as market reference only. | Implemented as boundary | `frontend/src/App.tsx`, `frontend/src/components/MarketChart.tsx` | Manual UI check; absence corroborated by route/source inventory |
| FR-16 | Display validated Binance ETHBTC historical/live candlesticks for ETH/BTC and reciprocal BTC/ETH on 1m, 5m, and 15m intervals, without presenting the data as DexSYS executions. | Implemented as external market data | `frontend/src/services/marketCandleService.ts`, `marketTickerService.ts`, `frontend/src/components/MarketChart.tsx` | `marketCandleService.test.ts`, `marketTickerService.test.ts`; browser verification |
| FR-17 | Expose read-only aggregated local order-book levels and render a polled cumulative depth view without exposing engine mutation or using external liquidity. | Implemented | `backend/crates/api/src/routes/market.rs`, `backend/crates/orderbook/src/lib.rs`, `frontend/src/components/OrderBookDepth.tsx` | API/orderbook unit tests; `frontend/src/services/orderBookService.test.ts` |

### Traceability notes

- The test commands and known test limitations are in [test plan](../04-testing/test-plan.md) and [test cases](../04-testing/test-cases.md).
- Four ignored PostgreSQL integration cases create test rows; they require a dedicated database ending in `_test`.
- Source references above are relative to the repository root; file links resolve from this document by prefixing `../../`.
- Automated source tests do not establish deployment readiness, external-service uptime, contract audit status, or on-chain integration.

## Broader project ambitions — not delivered requirements

The following ideas appear in early project language or may be future goals. They are not acceptance criteria for this MVP and must not be described as working features:

| ID | Ambition | Current status |
|---|---|---|
| FUT-01 | Wallet connection/signing, SIWE, and wallet-derived balances | Not implemented |
| FUT-02 | On-chain trade settlement, approvals, or vault integration with API trades | Not implemented |
| FUT-03 | AMM swaps, pools, liquidity provision/withdrawal | Not implemented |
| FUT-04 | Trade-history API and live depth streaming (read-only REST book snapshots are implemented) | Not implemented |
| FUT-05 | Historical charts, volume, and richer market subscriptions | Not implemented |
| FUT-06 | Governance, notifications, portfolio, transfers, and transaction tracking | Not implemented |
| FUT-07 | Production deployment, operational monitoring, and automated CI/CD | Not configured |

## Validation rules

For order submission the API requires non-empty ID/pair, finite positive quantity, and a valid limit price. `Market` exists in the serialized enum/storage model, but the matching adapter rejects it. A base quantity is scaled by 1,000,000 and price by 100; any fractional result at those scales or integer overflow is rejected rather than rounded. No available-balance check occurs.

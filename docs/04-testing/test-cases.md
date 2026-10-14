# Test cases and evidence map

| ID | Layer | Case / expected result | Evidence |
|---|---|---|---|
| TC-FE-01 | Frontend | Token parsing/maps response and rejects malformed token data. | `frontend/src/services/tokenService.test.ts` |
| TC-FE-02 | Frontend | Market selection and filters; empty/no-match behavior. | `frontend/src/domain/marketSelection.test.ts` |
| TC-FE-03 | Frontend | Activity filter includes expected order states. | `frontend/src/domain/orderActivity.test.ts` |
| TC-FE-04 | Frontend | Order DTO validation, HTTP status/error paths, calls. | `frontend/src/services/orderService.test.ts` |
| TC-FE-05 | Frontend | CoinGecko payload validation and USD quote mapping. | `frontend/src/services/marketDataService.test.ts` |
| TC-FE-06 | Frontend | Binance ticker parsing, state transitions, reconnect delay, teardown behavior. | `frontend/src/services/marketTickerService.test.ts` |
| TC-FE-07 | Frontend | Local domain orderbook fixture behavior; this fixture is not a live backend book. | `frontend/src/domain/orderBook.test.ts` |
| TC-FE-08 | Frontend | Local quote/state and persisted theme preference behavior. | `swapQuote.test.ts`, `swapState.test.ts`, `themePreference.test.ts` |
| TC-RS-01 | Rust | Order validation, exact fixed-point conversion, matching, book priority/FIFO, Auth0 validation. | `backend/crates/*/src`, especially API auth/matching and engine/book modules |
| TC-DB-01 | API/DB | Migrations, seeded token/pair, persistence, executed quantity/status, ownership, cancellation, restart restoration. | `backend/crates/api/tests/persistence.rs`; four ignored PostgreSQL cases |
| TC-SC-01 | Solidity | Vault deposits; partial/full withdrawal; zero/over-balance rejection; accepting and rejecting contract recipients. | Six cases in `contracts/test/SettlementVault.ts` |

## Manual acceptance checklist (not automated)

- Configure Auth0 callback/logout/web origin and API audience; sign in, create a unique-ID limit order, refresh order, and verify list scoping.
- Use two distinct Auth0 principals; verify neither can read or cancel the other's order and API returns `404`.
- Cancel a pending order and confirm it leaves the open list; repeat cancellation and observe conflict.
- Confirm frontend displays pair quotes/connection state independently from matching state and labels unavailable history, depth, volume, balances, and settlement.
- Disconnect provider/network access and verify error/stale/retry states without treating a retained price as live.
- Check desktop and mobile breakpoints manually; no accessibility audit is implied.
- Do not test or claim production deployment or on-chain order settlement; neither is available.

Manual cases require a real configured environment and should be marked `not run` until actually performed.
# Test coverage status

**No coverage percentage or coverage report is available in this repository.** There is no coverage script or CI artifact configuration. Do not infer a percentage from the number of test files or cases.

## Existing automated test areas

- Frontend: Vitest unit tests cover market selection, activity filtering, local orderbook helper, quote/swap-state helpers, theme preference, API order service, token service, CoinGecko parsing, Binance ticker/kline parsing and reconnect behavior, and candle normalization/update logic.
- Backend: Cargo unit tests cover orderbook, matcher, fixed-point/decimal conversions, Auth0 middleware and request validation. The normal test run excludes four ignored PostgreSQL integration cases.
- PostgreSQL: four explicitly ignored integration cases exercise persistence/migrations, matching/cancellation failure behavior and authenticated API lifecycle when run against a dedicated `_test` database.
- Contract: six Hardhat tests cover the standalone native-ETH vault contract. No cross-layer integration test exists.

## Gaps

No browser E2E, Rust coverage tooling, Solidity coverage report, fuzzing, performance/load test, production-chain test, deployment smoke test, formal accessibility suite, or verified end-to-end settlement test is present. Add a reproducible coverage pipeline before publishing any numeric coverage claim.
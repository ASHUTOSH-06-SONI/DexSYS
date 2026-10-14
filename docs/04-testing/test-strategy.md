# Test strategy

## Automated layers

1. **Frontend unit tests (Vitest):** domain filtering/selection/theme/order activity and service parsing/API behavior, including market prices and WebSocket lifecycle helpers.
2. **Rust unit tests:** request/order validation, numeric conversion, orderbook and price/time matching behavior, and Auth0 token validation via generated keys/local JWKS.
3. **Rust integration tests:** `backend/crates/api/tests/persistence.rs` includes a normal unauthenticated-route test and four ignored PostgreSQL cases. The ignored cases apply migrations and exercise seeding, persistence, authenticated owner isolation, matching, cancellation, and restoration. They require an isolated `_test` database.
4. **Hardhat tests:** six standalone `SettlementVault` Node tests use Hardhat's local simulated network to exercise deposit, partial/full withdrawals, invalid withdrawals, contract recipients, and rejecting recipients.
5. **Static/build checks:** ESLint plus Vite/TypeScript production build; Hardhat compilation.

## Verification limits

- No end-to-end browser automation, coverage instrumentation/report, fuzzing, load/performance test, chain deployment test, or contract audit is configured.
- The Solidity suite validates the vault itself only; it does not test an application integration.
- PostgreSQL behavior is not covered by the ordinary workspace test run unless the ignored cases are explicitly selected with a safe test database URL.
- Rust `cargo fmt --all --check` currently reports formatting differences in existing tracked Rust source; this documentation-only task did not reformat those files.
- Manual Auth0, live-provider, and responsive-browser checks are separate from automated results.

Keep automated, manual, skipped, and blocked results distinct in reports.
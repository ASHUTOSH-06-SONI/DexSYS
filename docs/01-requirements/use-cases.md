# Use cases

The flows below describe the current source implementation. REST paths are API paths without the local browser `/api` proxy prefix.

## UC-01 — View health and token metadata

**Actor:** unauthenticated visitor. **Precondition:** API and PostgreSQL are running for token lookup.

1. Client calls `GET /health` or `/`.
2. API returns service/version/status.
3. Client calls `GET /tokens/ETH` or `/tokens/BTC`.
4. API returns persisted token metadata; an unknown symbol returns `404`.

Token values are seeded reference values, not wallet balances or guaranteed current USD quotes. No token-list endpoint exists.

## UC-02 — Create a limit order

**Actor:** Auth0-authenticated trader. **Preconditions:** PostgreSQL available, Auth0 SPA/API configured, target pair seeded active/approved, token minted for the API audience.

1. Browser obtains an access token and sends `POST /orders` with ID, pair, side, type, price, and quantity.
2. API verifies RS256 signature, issuer, audience, expiry, and subject; principal is identified by issuer/subject.
3. API assigns the persisted principal ID as `user_id`, validates the limit order, and checks exact engine scaling.
4. Pair-specific engine is cloned and processes the new order. Crossed quantities become simulated executions; any remainder rests in the in-memory book.
5. Order, maker updates, executions, and audit events are committed in PostgreSQL. Only after commit does the process replace its live engine with the staged engine.
6. API returns the order record. `Pending` means a remainder rests; `Filled` means matcher quantity reached zero. Neither means blockchain settlement.

## UC-03 — View and cancel an order

**Actor:** Authenticated owner.

1. `GET /orders` returns only records whose principal ID matches the verified issuer/subject; `GET /orders/{id}` returns the owner's record.
2. `DELETE /orders/{id}` checks ownership and pending state, cancels the ID in a staged in-memory book, persists `Cancelled`, then installs the staged book.
3. Success is `204 No Content`. A repeat cancellation of the owned non-pending order is `409`; another user's or missing ID is `404`.

## UC-04 — Observe external market data

1. Frontend opens Binance public `ETHBTC` ticker WebSocket and separately polls CoinGecko REST.
2. It displays the Binance last price for ETH/BTC and reciprocal for BTC/ETH.
3. It displays CoinGecko USD prices and 24-hour changes. Provider errors and stale/connecting state are explicit.
4. This data does not enter the backend matcher. No live depth, chart history, or volume is supplied.

## UC-05 — Deposit and withdraw from standalone vault

On a local Hardhat simulated network, a caller can send native ETH to `deposit()` and withdraw a positive amount not exceeding their own recorded balance. A rejecting receiver reverts and preserves the recorded balance. This use case is contract-only: no frontend or API action invokes the vault.
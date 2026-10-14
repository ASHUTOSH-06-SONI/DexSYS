# User stories

Stories are grouped by delivered behavior. Acceptance IDs refer to [functional requirements](./functional-requirements.md).

## Delivered MVP stories

- **US-01 — Inspect the service and assets:** As a visitor, I want health and token metadata, so I can see whether the API responds and what demo/reference data it exposes. **Acceptance:** FR-01, FR-02.
- **US-02 — Sign in for private order actions:** As a trader, I want Auth0 sign-in to scope my order records, so another identity cannot list or operate on them. **Acceptance:** FR-03, FR-08.
- **US-03 — Submit an order:** As an authenticated trader, I want to submit a buy or sell limit order for a supported pair, so it can rest or match against compatible orders. **Acceptance:** FR-04–FR-07.
- **US-04 — Review/manage orders:** As an authenticated trader, I want to list, refresh, inspect, filter, and cancel my pending orders. **Acceptance:** FR-08, FR-10.
- **US-05 — View market references:** As a visitor, I want current provider-backed ETH/BTC spot and USD references with status indicators, so I can distinguish them from order engine state. **Acceptance:** FR-11–FR-13.
- **US-06 — Inspect the standalone vault:** As an evaluator, I want isolated vault deposit/withdrawal behavior tested, without confusing it with trade settlement. **Acceptance:** FR-14.

## Explicitly future stories

These are not committed MVP functionality: connecting/signing with a wallet; reading verified balances; settling an order on-chain; using AMM pools; viewing historical candles/live depth/volume; and managing portfolio, governance, or transfers. See `FUT-*` in [functional requirements](./functional-requirements.md#broader-project-ambitions--not-delivered-requirements).
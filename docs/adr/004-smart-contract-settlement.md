# ADR-004: Keep SettlementVault standalone from prototype matching

- **Status:** Accepted boundary (integration not implemented)
- **Date:** 2026-10-14 documentation baseline
- **Evidence basis:** Reconstructed from contract, frontend, API routes, and tests; no historical rationale is evidenced.

## Context

`SettlementVault` accepts native ETH and tracks per-caller balances for withdrawal. The backend writes simulated matcher executions to PostgreSQL but does not invoke the vault, sign transactions, or observe chain confirmations. The frontend has no wallet connection or settlement call.

## Decision

Document and test the contract as a standalone component only. Treat its test success as evidence for isolated deposit/withdrawal behavior, not as evidence that DexSYS trades settle on-chain.

## Alternatives

No historical integration design is recorded. A future audited settlement adapter/worker could connect verified trades to a deployed contract, but no protocol, token flow, deployment, or recovery design is established in this repository.

## Consequences

The contract can be exercised on Hardhat's local simulated network independently. Current order `Filled` status and PostgreSQL `settlements` schema do not prove chain settlement. Wallet connectivity, deployment, chain confirmation, reconciliation, and security review remain outstanding.
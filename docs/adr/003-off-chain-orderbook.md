# ADR-003: Match limit orders off-chain in process memory

- **Status:** Accepted (current implementation; durability limitations remain)
- **Date:** 2026-10-14 documentation baseline
- **Evidence basis:** Reconstructed from API, `matching-engine`, `orderbook`, schema, and tests. Rationale is inferred, not historically documented.

## Context

The API keeps one Rust matching engine per pair. It stages each order against a cloned engine, persists order/maker/execution/audit changes in a PostgreSQL transaction, then swaps in the staged engine after commit. Pending limit orders are restored on process startup with priority sequence.

## Decision

Use off-chain price-crossing limit matching with fixed-point engine integers (100 ticks per API price unit; 1,000,000 quantity units per API quantity unit). Reject unrepresentable values and market orders. Persist executed quantities as database trade rows but do not call them on-chain settlement.

## Alternatives

No historical deliberation is recorded. A durable external matching service, event log/outbox, or chain-based matching could address different scale/finality needs, but none is implemented here.

## Consequences

Matching behavior is locally testable and each pair is isolated in state. PostgreSQL transaction success precedes active-memory publication. Process memory and PostgreSQL are still not a distributed transaction: only pending limits restore; past executions are not replayed; no outbox/reconciliation exists. Multiple API replicas would have independent books and are not a supported deployment.
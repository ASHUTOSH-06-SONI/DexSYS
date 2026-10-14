# ADR-001: Separate web client, HTTP API, and contract workspace

- **Status:** Accepted (current architecture)
- **Date:** 2026-10-14 documentation baseline
- **Evidence basis:** Reconstructed from current repository source; this is not a claim about an original decision meeting.

## Context

The repository contains a React/Vite client, a Rust/Axum API with PostgreSQL persistence, and an independent Hardhat/Solidity workspace. The client calls the backend for tokens/orders and connects directly to public market-data providers.

## Decision

Keep the browser UI, API, and Solidity contract as separately built components. The app's active order lifecycle is API/database/in-memory matching; the contract workspace is standalone and is not in the order request path.

## Alternatives

No historical alternative comparison is recorded in the repository. A fully on-chain orderbook or integrated contract settlement would require a different request/finality flow and is not present.

## Consequences

Component boundaries can be tested locally with their native toolchains. However, separate repositories/workspaces do not imply end-to-end integration; in particular, `SettlementVault` deposits/withdrawals do not settle matched orders. Deployment topology and CI remain future work.
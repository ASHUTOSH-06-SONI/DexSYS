# Software Requirements Specification

**Project:** DexSYS academic software-engineering MVP
**Baseline:** Repository `main`, inspected 14 October 2026
**Status:** As-built specification; implementation is a test-environment prototype

## Purpose and audience

This specification records the observable requirements implemented by the current repository and separates them from the project's broader DEX ambitions. It is for project evaluators, developers, testers, and maintainers. Requirement IDs and their implementation/test evidence are in [functional requirements](./functional-requirements.md); quality constraints are in [non-functional requirements](./non-functional-requirements.md).

## System boundary

The MVP is a browser client, an Axum HTTP API, PostgreSQL persistence, and an in-process Rust limit-order matcher. Auth0 access tokens identify API users. External market data comes directly from Binance's public ETHBTC ticker WebSocket and CoinGecko's public USD-price REST endpoint. A standalone Solidity `SettlementVault` accepts and returns native ETH, but no order/trade path calls it.

The order book is an off-chain prototype. A database record marked `Filled` or an engine-produced row in `trades` means the Rust matcher recorded a simulated execution; it does **not** mean assets were transferred or settled on-chain. This distinction is fundamental to every MVP claim.

## Delivered capabilities

- Public health and individual token metadata reads.
- Auth0-authenticated order create, list, get, and cancel routes scoped to issuer/subject.
- Limit-order matching in memory for seeded `ETH/BTC` and `BTC/ETH` pairs, with PostgreSQL records and engine-produced executions.
- Browser order entry and persisted order history; token search/filtering and external reference prices.
- Standalone ETH deposit/withdrawal vault with Hardhat tests.

## Explicitly outside the delivered system

There is no wallet provider/signing, wallet balance verification, balance reservation, AMM, on-chain trade settlement, contract/API integration, public orderbook/trades API, historical chart feed, live depth feed, or volume feed. Token balances and backend USD values are seeded reference values. Deployment and automated CI are not configured in this repository.

## Operating assumptions and constraints

- Local API startup requires PostgreSQL and valid Auth0 tenant configuration; the frontend requires an Auth0 SPA/API setup for sign-in and order features.
- Native Rust, Node.js, and PostgreSQL development is supported; Docker is not a prerequisite.
- API amounts are JSON numbers (`f64`); matching accepts only values exactly representable at the documented fixed-point scales.
- The service binds to `127.0.0.1:8080`; local Vite development proxies `/api` to it.
- External market providers are independent of DexSYS order execution and availability.

## Traceability

See [FR/NFR traceability](./functional-requirements.md#traceability-notes) for each delivered requirement's source and automated test evidence. Feature ideas beyond this baseline are identified as **not implemented** rather than implied by this SRS.

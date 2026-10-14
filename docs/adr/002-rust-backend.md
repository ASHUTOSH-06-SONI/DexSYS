# ADR-002: Rust Axum API with PostgreSQL persistence

- **Status:** Accepted (current implementation)
- **Date:** 2026-10-14 documentation baseline
- **Evidence basis:** Reconstructed from `backend/`; rationale below is inferred where noted.

## Context

The API crate uses Axum/Tokio and SQLx PostgreSQL migrations/repositories. Startup applies migrations, seeds missing sample token/pair rows, restores pending limit orders, validates Auth0 access tokens, then binds loopback port 8080.

## Decision

Use Rust/Axum as the HTTP boundary, SQLx/PostgreSQL for durable records, and middleware for issuer/audience/signature-bound Auth0 identity.

## Alternatives

No historical alternatives or rationale are recorded. Other HTTP/database frameworks are plausible alternatives, but were not selected in the current source.

## Consequences

Orders can be persisted and owner-scoped; database schema and lifecycle tests are explicit. Local development requires PostgreSQL and Auth0 tenant configuration. API JSON financial values remain `f64` and must be checked when converted to the engine's integer scale. The service binds to loopback and is not deployment-ready.
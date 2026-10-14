# Deployment guide — future work

> **Status: planned only.** The repository has no production deployment configuration and no deployment success has been verified. This guide records gates and a possible topology; it is not a runbook for an existing environment.

## Verified local operation

The supported local development topology uses native processes: Vite frontend on its dev port, Rust API on loopback port 8080, local PostgreSQL, Auth0 for login/access tokens, and direct browser connections to public Binance/CoinGecko endpoints. Follow [getting started](../getting-started.md).

## Future deployment prerequisites

Before any hosted deployment, define and test:

- HTTPS reverse proxy with same-origin `/api` forwarding, because the API currently binds to loopback and has no CORS middleware.
- Private PostgreSQL provisioning, backups, migration/rollback policy, credentials rotation, and recovery runbook.
- API bind/configuration suitable for the hosting platform; startup Auth0 issuer/audience and JWKS reachability.
- Frontend Auth0 callback/logout/origin allowlists and safe public environment values.
- Rate limits, monitoring, logs, resource limits, health/readiness semantics, incident response, and threat/security review.
- Matching-state recovery/consistency design; current books are process memory and no durable execution outbox exists.
- Explicit decision whether and how any order could settle on-chain. The current `SettlementVault` is not integrated and a matcher `Filled` record is not a chain settlement.

## Do not deploy as an exchange

This academic MVP has no custody/balance reservation, price-time policy audit, production load assurance, chain settlement, or completed security/deployment verification. Do not route real user funds or imply production readiness.

## Deployment evidence

No environment URL, deployment artifact, deployment workflow, or deployment test is present in the repository. Record future deployment evidence only after an actual, independently verified deployment.
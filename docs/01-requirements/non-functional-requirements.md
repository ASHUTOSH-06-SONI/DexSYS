# Non-functional requirements

These constraints describe the current local MVP, not a production service-level commitment.

| ID | Requirement | Current evidence/status |
|---|---|---|
| NFR-01 | Preserve ownership isolation for order list/read/cancel operations. | Enforced by verified Auth0 principal and owner-filtered SQL; cross-user records return `404`. |
| NFR-02 | Reject invalid, non-finite, and unsupported precision financial inputs without rounding. | Implemented by validation/conversion; API contract still uses JSON `f64`, with representability checks on reads. |
| NFR-03 | Persist order lifecycle transitions and matcher executions atomically within a PostgreSQL transaction. | Implemented for the described rows/audit events; this does not make PostgreSQL and process memory atomically durable together. |
| NFR-04 | Restore pending limit orders on process startup and maintain per-pair engine isolation. | Implemented; only pending limit orders are restored. |
| NFR-05 | Show unavailable/stale/error conditions rather than fabricate live chart, depth, volume, or wallet data. | Implemented in current frontend. |
| NFR-06 | Keep local development available without a container runtime. | Native Cargo, Node/npm, and PostgreSQL workflow exists; Docker configuration is absent. |
| NFR-07 | Keep API access token validation cryptographic and audience/issuer-bound. | Auth0 JWKS RS256 validation implemented. Not a complete production security review. |
| NFR-08 | Provide responsive client layouts and keyboard-operable web controls. | Responsive styles and semantic controls exist; no automated accessibility audit is recorded. |
| NFR-09 | Support reproducible dependency installation from committed lockfiles. | Cargo/npm lockfiles exist; lockfile installation commands are documented. |

## Known quality and operational limits

- API listens only on loopback (`127.0.0.1:8080`); there is no production server binding/reverse-proxy configuration or CORS middleware.
- Matching books are process memory. Pending limits are restored from PostgreSQL, but previous executions are not replayed into the book and no durable outbox/reconciliation protocol exists.
- The orders/trades/database operations do not reserve balances or transfer assets. A matcher execution is not settlement.
- API financial JSON values are `f64`; PostgreSQL uses `NUMERIC(38,18)`. Reads reject database decimals that cannot round-trip exactly through the API number representation.
- External Binance and CoinGecko availability, quotas, data correctness, and latency are outside DexSYS control.
- No benchmarks, formal availability target, disaster-recovery plan, deployed environment, coverage report, or completed security assessment is evidenced by repository automation.
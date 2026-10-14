# CI/CD status

## Observed configuration

No tracked GitHub Actions workflow or other CI/CD definition exists at repository root or under `backend/.github/workflows/`. No release, artifact publication, deployment, or automated database service setup is configured. Empty workflow/infrastructure directories, if present in a checkout, are not automation.

## Candidate validation pipeline (proposal, not configured)

A later pipeline could run:

1. Frontend `npm ci`, `npm test`, `npm run lint`, and `npm run build`.
2. Rust `cargo test --workspace`; add `cargo fmt --check` after existing formatting differences are resolved.
3. API persistence integration test against a freshly provisioned isolated PostgreSQL database ending in `_test`.
4. Contracts `npm ci`, `npm test`, and `npx hardhat build`.
5. Link checking and secret scanning of documentation/artifacts.

No successful remote run is evidenced. Until workflows and environment handling are added and observed, describe CI and deployment as future work, not an achieved state.

The current Rust workspace test passes locally, but `cargo fmt --all --check` currently fails on pre-existing formatting differences. This state should be reconciled before making formatting a required CI gate.
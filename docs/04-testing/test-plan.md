# Test plan

## Scope

Validate the frontend, Rust workspace, API/Auth0 boundaries, optional PostgreSQL persistence lifecycle, and standalone Solidity vault. Automated tests cover logic and selected integration flows. They do not establish production readiness, external-provider SLAs, deployment success, or on-chain settlement integration.

## Prerequisites

- Rust stable toolchain and Cargo; PostgreSQL server for backend runtime.
- Node.js/npm for frontend and contracts.
- A dedicated PostgreSQL database named with `_test` suffix only for the four ignored persistence integration cases.
- Auth0 tenant configuration for manual browser login and real backend startup. Rust auth tests use local generated test keys/JWKS and do not require a production tenant.
- Contract tests use Hardhat's simulated network and do not require a funded wallet or remote RPC.

No Docker installation is required.

## Automated test commands

From repository root:

```sh
(cd frontend && npm ci && npm test)
(cd frontend && npm run lint && npm run build)
cargo test --manifest-path backend/Cargo.toml --workspace
(cd contracts && npm ci && npm test)
(cd contracts && npx hardhat build)
```

Ignored PostgreSQL integration cases (mutate their dedicated database; they do not clean uniquely named fixture rows):

```sh
createdb dexsys_test
DEXSYS_TEST_DATABASE_URL=postgresql://localhost/dexsys_test \
  cargo test --manifest-path backend/Cargo.toml -p api --test persistence -- --ignored
```

Use a disposable, isolated test database and never substitute a development or shared database. The code refuses a database URL whose final database name does not end with `_test`.

## Manual checks

See [test cases](./test-cases.md) for login, ownership, UI, provider, and failure-state checks. External market feeds require network access; browser tests of signed-in operations require correctly configured Auth0 and a running API/DB. Manual checks are not automated acceptance evidence.

## Result recording

Record the exact command, date, environment, and pass/fail in the submission evidence. Do not infer test counts or coverage percentages from test sources; no coverage job/report is configured.

## Verification snapshot (14 October 2026)

Executed from the repository checkout:

- Frontend `npm test`: **41 passed across 10 test files**; `npm run lint` and `npm run build`: passed.
- Rust workspace `cargo test --manifest-path backend/Cargo.toml --workspace`: **24 passed; four PostgreSQL cases ignored by default**.
- PostgreSQL command above, using a newly created isolated `_test` database that was removed after the run: **four passed**.
- Contracts `npm test`: **six passed**. `npx hardhat build` completed; a forced compile was also requested to verify Solidity compilation.
- `cargo fmt --manifest-path backend/Cargo.toml --all --check` was attempted and **failed on pre-existing Rust formatting differences**. No Rust sources were changed for this documentation task.

These local results do not establish a deployment, production readiness, or on-chain settlement integration. The Rust build reports a pre-existing unused-import warning; Hardhat tests report a deprecation warning for `network.connect()`.
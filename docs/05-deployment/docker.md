# Containers and native development

## Current repository state

There is no Dockerfile, Compose file, container image definition, or container orchestration configuration in the tracked repository. The `backend/docker/` directory is empty. Therefore DexSYS currently has no supported containerized local workflow.

Docker Desktop is **not** a local-development prerequisite. Use native Rust/Cargo, Node/npm, and PostgreSQL as described in [getting started](../getting-started.md). This avoids requiring Docker Desktop storage or installation.

## Remote build/test option

If local disk or toolchain capacity is limited, run the documented npm/Cargo/Hardhat commands on a separate machine or a hosted runner with the required toolchains and PostgreSQL. This repository has no checked-in CI workflow, so the remote route must be provisioned by the operator; it is not automatic or verified by DexSYS.

Containerization may be designed later, but adding images or infrastructure is outside the present documentation baseline.
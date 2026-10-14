# DexSYS contracts

This Hardhat 3 workspace contains `contracts/core/SettlementVault.sol`, a standalone native-ETH deposit/withdrawal contract. Per-address balances are tracked; withdrawals must be positive and within the caller's balance, and a failed ETH transfer reverts.

## Tests and build

From `contracts/`:

```sh
npm ci
npm test
npx hardhat build
```

The six tests use Hardhat's local simulated network and cover deposits, partial/full withdrawals, invalid withdrawals, contract recipients, and rollback when a recipient rejects ETH. Tests do not require a funded wallet or external RPC.

## Integration and deployment status

The contract is **not integrated** with Rust order matching, PostgreSQL trade records, Auth0, or the React interface. No DexSYS wallet connection, trade settlement, approval, chain confirmation, or vault deployment has been implemented. A database `settlements` table is not proof of a running settlement path.

`hardhat.config.ts` declares local simulated networks and a Sepolia HTTP network configured through `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY`. No checked-in Ignition deployment module, contract deployment record, or successful network deployment is evidenced. Do not treat network configuration as a deployed contract or use a private key in local tests.

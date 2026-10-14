# Wallet and settlement APIs: not implemented

No wallet-connect, wallet-signing, SIWE, balance, allowance, deposit, withdrawal, token-transfer, chain transaction, or trade-settlement endpoint exists in the Axum router.

Auth0 authenticates an application principal for order API calls. It does not prove wallet control. The UI labels sample balances as seeded and does not submit blockchain transactions.

`SettlementVault` is a separate Solidity contract with a standalone `deposit()`/`withdraw(uint256)` interface (see [contract docs](../../contracts/README.md)). It is not deployed by a checked-in configuration, invoked by the backend/frontend, or connected to order/trade rows. Those contract functions are not DexSYS HTTP APIs.
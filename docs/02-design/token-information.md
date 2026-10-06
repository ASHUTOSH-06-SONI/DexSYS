# Validated Token Information

## Purpose

DexSYS provides traders with a compact token-information view before they select an asset for trading. The view is intended to make the supported asset and its validation status clear without requiring the user to leave the trading workspace.

## User Story

> As a user, I want to view validated token information so that I can make informed trading decisions.

## Information Displayed

For each supported token, the interface displays:

- Token name and symbol
- Validation status
- Contract/address identifier
- Current indicative price
- 24-hour price movement
- Available balance when a wallet is connected
- Supported trading pairs
- A short risk/validation note

## Validation States

The prototype uses three conceptual states:

- **Validated** — token metadata has passed DexSYS validation checks and is eligible for display/trading.
- **Pending review** — metadata is known but validation is not complete.
- **Unsupported** — the token is not currently approved for DexSYS trading.

Only validated assets are presented as supported trading assets in the current prototype.

## User Flow

1. User opens the DexSYS trading workspace.
2. User selects or inspects a supported token.
3. DexSYS displays the token's identity and validation status.
4. User reviews price, movement, balance, and supported pairs.
5. User can use the information to decide whether to continue to the swap interface.

## Current Prototype Behaviour

The frontend uses a local list of representative testnet token metadata. Validation status is represented explicitly in the UI and does not yet call a backend validation service. Contract identifiers and market values are demonstration data.

## Future Integration

The local token metadata should be replaced with the validated-token API represented by the backend. The frontend should consume the API response, handle loading/error states, and prevent unsupported assets from being offered as tradable selections.

## Acceptance Criteria

- A user can identify the selected token by name and symbol.
- The interface clearly shows whether the token is validated.
- The interface shows indicative price and 24-hour movement.
- The interface exposes the token contract/address identifier.
- Wallet balance is shown when wallet state is available.
- Supported trading pairs are visible.
- The implementation does not claim that demonstration data has been verified on-chain.

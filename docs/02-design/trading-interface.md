# Trading Interface Design

## Purpose

The DexSYS trading interface provides a single workspace for viewing indicative market prices, entering a token swap, reviewing wallet balances, and checking recent orders.

## User Flow

1. User opens the Trade view.
2. User connects a wallet when trading functionality is required.
3. User selects the token to pay and the token to receive.
4. User enters an amount or selects the available balance with **MAX**.
5. DexSYS displays an indicative quote, rate, price impact, and estimated network fee.
6. User reviews the swap before submission.
7. Recent orders and market information remain available from the same interface.

## Interface Components

### Navigation

- DexSYS brand and application identity
- Trade, Markets, and Activity navigation
- Wallet connection control
- Network indicator

### Swap Panel

- Pay-token selector and amount input
- Receive-token selector and quoted amount
- Token direction switch
- Trading fee indicator
- Quote details
- Review-swap action

The review action remains unavailable until a wallet is connected and a positive amount has been entered.

### Market Overview

The market panel displays indicative prices for supported pairs and percentage movement. It also provides the connected portfolio balance.

### Orders

The Orders tab displays recent trading activity with pair, side, amount, price, and status.

### Activity

The Activity section provides a compact table of recent trades and a placeholder navigation path for the complete activity view.

## Current Prototype Behaviour

The current frontend uses representative testnet values for market prices and portfolio data. Swap quotes are calculated locally for the supported ETH/USDC and WBTC/USDC pairs. This is intentionally a UI prototype and does not submit blockchain transactions yet.

## Future Integration Points

- Replace local token data with the token-information API.
- Replace local quote calculations with the trading/quote API.
- Connect wallet state to the authentication and account flow.
- Submit reviewed swaps through the trading API and smart-contract layer.
- Replace representative order history with persisted user activity.

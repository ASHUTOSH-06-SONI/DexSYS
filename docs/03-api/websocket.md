# Market data feeds (external providers)

These browser-to-provider feeds are separate from the DexSYS Axum API. The backend offers no market-data WebSocket, orderbook stream, or trade stream.

## Binance spot ticker

- Public URL: `wss://stream.binance.com:9443/ws/ethbtc@ticker`
- Frontend service: `frontend/src/services/marketTickerService.ts`
- Accepts only Binance 24-hour ticker messages for symbol `ETHBTC`; uses the message's last price `c`.
- Frontend displays the tick as ETH/BTC and displays BTC/ETH as its reciprocal.
- States: `connecting`, `live`, `reconnecting`, `disconnected`. The last value/time is retained and marked stale by UI after disconnection.
- Reconnect delay doubles from one second to a maximum 30 seconds and stops after eight attempts; UI offers manual retry. Unmount cleans up socket and retry timer.

This feed gives a spot ticker only. It does not populate the Rust matching engine, provide a depth book, a historical candle chart, or volume data.

## CoinGecko USD references

The frontend calls the public CoinGecko `/api/v3/simple/price` endpoint for ETH, BTC, USDC, and WBTC in USD with `include_24hr_change=true`. It refreshes every 60 seconds, retains last successful quotes as stale on errors, and exposes errors/retry in the UI. Provider quotas/availability apply. These reference prices are not the order's limit price or an execution guarantee.

No API key or credential should be put in frontend environment variables for these public calls.
# Market data feeds (external providers)

These browser-to-provider feeds are separate from the DexSYS Axum API. The backend offers no market-data WebSocket, orderbook stream, or trade stream. Local resting-order depth is available as a public REST snapshot at `GET /market/depth/{base}/{quote}`; the frontend polls that endpoint while the Depth tab is selected.

## Binance spot ticker and kline stream

- Combined public URL: `wss://stream.binance.com:9443/stream?streams=ethbtc@ticker/ethbtc@kline_<interval>`
- The frontend selects one of Binance's `1m`, `5m`, or `15m` kline streams alongside the ticker on a single WebSocket connection.
- Frontend service: `frontend/src/services/marketTickerService.ts`
- Accepts Binance 24-hour ticker messages for symbol `ETHBTC` and kline messages whose symbol/interval match the subscription. Ticker last price `c` updates the spot display; kline OHLC values update the current interval candle.
- Frontend displays the tick as ETH/BTC and displays BTC/ETH as its reciprocal.
- States: `connecting`, `live`, `reconnecting`, `disconnected`. The last value/time is retained and marked stale by UI after disconnection.
- Reconnect delay doubles from one second to a maximum 30 seconds and stops after eight attempts; UI offers manual retry. Unmount cleans up socket and retry timer.

Changing interval closes the previous combined stream and subscribes to the new one. The stream is external market data; it does not populate the Rust matching engine, provide a depth book, or represent DexSYS executions or volume.

## Binance historical klines

The chart fetches up to 500 candles from the public `GET https://api.binance.com/api/v3/klines` endpoint with symbol `ETHBTC` and the selected interval. Responses are checked for valid timestamps, interval alignment, finite OHLC/volume values, and consistent high/low bounds. BTC/ETH is displayed using inverse prices; Binance quote volume is not displayed as DexSYS trading volume. The REST request and kline stream are independent of CoinGecko USD reference prices.

## CoinGecko USD references

The frontend calls the public CoinGecko `/api/v3/simple/price` endpoint for ETH, BTC, USDC, and WBTC in USD with `include_24hr_change=true`. It refreshes every 60 seconds, retains last successful quotes as stale on errors, and exposes errors/retry in the UI. Provider quotas/availability apply. These reference prices are not the order's limit price or an execution guarantee.

No API key or credential should be put in frontend environment variables for these public calls.
# API inventory: health, tokens, and trades

## Implemented public routes

| Method and path | Authentication | Success response |
|---|---|---|
| `GET /` | None | `200` JSON `{ "service": "DexSYS API", "version": "0.1.0", "status": "running" }` |
| `GET /health` | None | Same health JSON |
| `GET /tokens/{symbol}` | None | `200` JSON `TokenInfo`: `symbol`, `name`, `validated`, `price`, `change_24h`, `balance`, `contract_address`, `supported_pairs` |
| `GET /market/depth/{base}/{quote}` | None | `200` JSON `{ "trading_pair": "ETH/BTC", "bids": [...], "asks": [...] }`; each level has decimal-string `price`, `quantity`, and `cumulative_quantity` |

Unknown token symbols return `404` `{ "error": "Token Not Found" }`; persistence failures return `500`. Seeded token fields are demo/reference data; `balance` is not a wallet balance. There is no token-list route.

The depth route returns actual resting levels from the in-memory matching engine for the requested pair. Bids are price-descending and asks price-ascending; quantities are aggregated using the engine's integer units and serialized as exact decimal strings. A missing/uninitialized engine book returns empty sides. Invalid quantities or arithmetic overflow returns `500` rather than partial depth. Reads take the matching-engine mutex only to snapshot aggregate levels. The frontend polls this route while its Depth tab is selected; this is not a WebSocket feed, Binance liquidity, execution volume, or settlement history.

## Trades

There is **no implemented `GET /trades` or trade-history HTTP endpoint**. The matching code persists a `trades` row for each engine-produced execution as part of the order transaction. These rows are not blockchain-confirmed executions, and settlement status is not exposed by an API. Do not call a `trades` endpoint from clients; it will not be served.

See [orders](./orders.md) for the implemented order routes and [external market data](./websocket.md) for provider feeds, which are not trade routes.

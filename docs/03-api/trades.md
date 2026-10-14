# API inventory: health, tokens, and trades

## Implemented public routes

| Method and path | Authentication | Success response |
|---|---|---|
| `GET /` | None | `200` JSON `{ "service": "DexSYS API", "version": "0.1.0", "status": "running" }` |
| `GET /health` | None | Same health JSON |
| `GET /tokens/{symbol}` | None | `200` JSON `TokenInfo`: `symbol`, `name`, `validated`, `price`, `change_24h`, `balance`, `contract_address`, `supported_pairs` |

Unknown token symbols return `404` `{ "error": "Token Not Found" }`; persistence failures return `500`. Seeded token fields are demo/reference data; `balance` is not a wallet balance. There is no token-list route.

## Trades

There is **no implemented `GET /trades` or trade-history HTTP endpoint**. The matching code persists a `trades` row for each engine-produced execution as part of the order transaction. These rows are not blockchain-confirmed executions, and settlement status is not exposed by an API. Do not call a `trades` endpoint from clients; it will not be served.

See [orders](./orders.md) for the implemented order routes and [external market data](./websocket.md) for provider feeds, which are not trade routes.

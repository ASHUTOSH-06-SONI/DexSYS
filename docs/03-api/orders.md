# Orders API

All paths below are paths served by Axum. In local browser development, Vite exposes them under `/api` and removes that prefix before forwarding.

## Authentication and ownership

Every order endpoint requires `Authorization: Bearer <access-token>`. The API validates Auth0 issuer, audience, expiry and RS256 signature. List/get/cancel are scoped to the verified issuer/subject. A missing or other user's ID returns `404`, avoiding ownership disclosure. The create payload cannot choose the owner; the API derives `user_id` from its mapped principal.

## Order JSON

```ts
type OrderSide = "Buy" | "Sell";
type OrderType = "Limit" | "Market"; // Market is rejected by the current engine adapter
type OrderStatus = "Pending" | "Filled" | "Cancelled";

interface CreateOrderRequest {
  id: string;                 // client-supplied unique ID
  trading_pair: string;       // e.g. ETH/BTC
  side: OrderSide;
  order_type: OrderType;
  price: number | null;       // positive for Limit; null for Market
  quantity: number;           // positive base-token amount
}

interface Order {
  id: string;
  user_id: string;            // server-assigned principal ID rendered as text
  trading_pair: string;
  side: OrderSide;
  order_type: OrderType;
  price: number | null;
  quantity: number;            // original submitted amount
  status: OrderStatus;
}
```

`owner_principal_id` is internal and omitted from JSON. Decimal request/response fields use JSON numbers backed by Rust `f64`, not decimal strings.

## Routes

| Method and path | Success | Behavior |
|---|---|---|
| `POST /orders` | `200 OK`, `Order` JSON | Validates and submits a limit order. A limit order can match immediately, partially match, or rest. Pair must exist and be active/approved. |
| `GET /orders` | `200 OK`, `Order[]` JSON | Lists all records owned by the principal, ordered by creation time then ID. |
| `GET /orders/{id}` | `200 OK`, `Order` JSON | Retrieves one owned record. Missing and not-owned both return `404`. |
| `DELETE /orders/{id}` | `204 No Content` | Cancels an owned pending order and removes it from the current in-process book. Repeat cancellation returns `409`. |

Application failures and status codes are tabulated in [error codes](./error-codes.md). Token and health endpoints are described in [API overview](./trades.md) (the endpoint inventory); trades and wallet capabilities are explicitly not implemented in the [trade](./trades.md) and [wallet](./wallet.md) references.

## Validation and persistence

Limit `price` must be finite and positive; `quantity` finite and positive; ID, pair non-empty. The API matcher converts price by ×100 (tick 0.01) and quantity by ×1,000,000 (unit 0.000001), requiring exact representability and `i64` range. No rounding or balance reservation. Market requests are rejected with `400`.

Submission writes the incoming row, affected maker remaining/status changes, each matcher-produced execution, and corresponding audit events in a PostgreSQL transaction. The staged per-pair engine state is installed only after commit. The API response's `quantity` is original quantity; no `remaining_quantity` is returned. Filled/order rows describe only off-chain matching, not token transfer or settlement.

Only pending limit orders are restored on startup. Past executions are persisted in `trades` but there is no public trade-read route or execution replay into the in-memory book.
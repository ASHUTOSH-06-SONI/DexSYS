# HTTP errors

Application error bodies use JSON `{ "error": "<message>" }`.

| Status | Error message | Meaning |
|---|---|---|
| `400` | `Invalid Order` | Invalid financial/order fields, unsupported market order, unrepresentable engine scale, or invalid/inactive pair mapped to an invalid order. |
| `401` | `Unauthorized` | Missing or invalid bearer access token on order routes. |
| `404` | `Token Not Found` | Token symbol is not present. |
| `404` | `Order Not Found` | Order is absent or not owned by the authenticated principal. |
| `409` | `Order Already Exists` | Duplicate order ID (database unique violation). |
| `409` | `Invalid Order State Transition` | Owned order is not pending for cancellation. |
| `500` | `Persistence operation failed` | Database/persistence operation failed; inspect server logs without exposing database details to the caller. |
| `503` | `Authentication service unavailable` | Auth0 JWKS cannot be obtained/parsed. |

Axum's JSON/path extraction rejections occur before application error mapping and may use framework-generated responses; do not assume every malformed request has the JSON shape above. The frontend also reports network errors and invalid response payloads distinctly.
# Order lifecycle sequence diagrams

## Submission, matching, and persistence

```mermaid
sequenceDiagram
  actor Trader
  participant UI as React UI
  participant Auth as Auth0
  participant API as Axum order route
  participant DB as PostgreSQL
  participant Engine as Staged pair matcher
  Trader->>UI: Submit limit (ID, pair, side, price, quantity)
  UI->>Auth: Obtain API access token
  Auth-->>UI: Access token
  UI->>API: POST /orders + Bearer token
  API->>Auth: Validate issuer/audience/signature via JWKS
  Auth-->>API: Verified issuer/subject
  API->>DB: Resolve/create principal
  API->>API: Validate order and exact fixed-point scales
  API->>Engine: Clone active engine and process order
  Engine-->>API: Trades + resting remainder/status
  API->>DB: Transaction: order, makers, executions, audits
  DB-->>API: Commit success
  API->>API: Publish staged engine in AppState
  API-->>UI: 200 order JSON
  UI-->>Trader: Show API response and refresh history
```

If database persistence fails, the staged engine is not installed. Memory and database still do not form a distributed transaction, and no durable execution outbox exists.

## Cancellation

```mermaid
sequenceDiagram
  actor Trader
  participant UI as React UI
  participant API as Axum order route
  participant DB as PostgreSQL
  participant Engine as Pair engine
  Trader->>UI: Cancel pending order
  UI->>API: DELETE /orders/{id} + Bearer token
  API->>API: Validate principal
  API->>DB: Find order owned by principal
  DB-->>API: Owned order or not found
  API->>Engine: Clone book and remove order ID
  API->>DB: Update owned PENDING row to CANCELLED + audit
  DB-->>API: Commit success
  API->>Engine: Replace active book with staged book
  API-->>UI: 204 No Content
```

Cancellation cannot settle, refund, or release a wallet balance: no balance reservation is implemented.
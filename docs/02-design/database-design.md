# PostgreSQL schema

The SQLx migrations in `backend/migrations/` create these relations. Monetary fields are PostgreSQL `NUMERIC(38,18)`. This schema does not imply that an on-chain settlement flow exists.

```mermaid
erDiagram
  TOKENS ||--o{ TRADING_PAIRS : base_asset
  TOKENS ||--o{ TRADING_PAIRS : quote_asset
  TRADING_PAIRS ||--o{ ORDERS : identifies_pair
  AUTH_PRINCIPALS o|--o{ ORDERS : optional_owner
  TRADING_PAIRS ||--o{ TRADES : contains
  ORDERS ||--o{ TRADES : buy_order
  ORDERS ||--o{ TRADES : sell_order
  TRADES o|--o{ SETTLEMENTS : optional_reference
  TOKENS {
    text id PK
    text symbol UK
    text name
    numeric price
    numeric change_24h
    numeric balance
    text[] supported_pairs
  }
  TRADING_PAIRS {
    text id PK "BASE/QUOTE"
    text base_token_id FK
    text quote_token_id FK
    boolean active
    boolean approved
  }
  AUTH_PRINCIPALS {
    bigint id PK
    text issuer
    text subject
  }
  ORDERS {
    text id PK
    text user_id
    bigint owner_principal_id FK "nullable for legacy rows"
    text trading_pair_id FK
    text side
    text order_type
    numeric price
    numeric original_quantity
    numeric remaining_quantity
    text status
    bigint priority_sequence
  }
  TRADES {
    text id PK
    text trading_pair_id FK
    text buy_order_id FK
    text sell_order_id FK
    numeric execution_price
    numeric execution_quantity
    timestamptz executed_at
  }
  SETTLEMENTS {
    text id PK
    text trade_id FK "nullable"
    bigint chain_id
    text transaction_hash "nullable"
    text status
  }
  AUDIT_EVENTS {
    text id PK
    text entity_type
    text entity_id
    text event_type
    jsonb metadata
    timestamptz created_at
  }
```

`trades` references the buy/sell orders together with the same pair using composite foreign keys. `orders.owner_principal_id` was added nullable so legacy rows remain unassigned; they are not automatically mapped to a login identity. Issuer/subject pairs in `auth_principals` are unique.

`settlements` and `audit_events` are database structures only. There is no settlement API/worker, chain observer, or transaction-confirmation flow. Audit writes cover code paths that explicitly call the repository audit helper; do not assume every failed or successful HTTP request is logged.

The API does not expose token-list, pair-list, trade-list, or settlement-list routes. Startup inserts missing demo tokens and pairs using `ON CONFLICT DO NOTHING`; this does not refresh existing seeded rows.
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contract_address TEXT,
    chain_id BIGINT,
    validated BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (price >= 0),
    change_24h NUMERIC(38, 18) NOT NULL DEFAULT 0,
    balance NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    supported_pairs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trading_pairs (
    id TEXT PRIMARY KEY,
    base_token_id TEXT NOT NULL REFERENCES tokens(id),
    quote_token_id TEXT NOT NULL REFERENCES tokens(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trading_pairs_distinct_tokens CHECK (base_token_id <> quote_token_id),
    CONSTRAINT trading_pairs_unique_tokens UNIQUE (base_token_id, quote_token_id)
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trading_pair_id TEXT NOT NULL REFERENCES trading_pairs(id),
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type TEXT NOT NULL CHECK (order_type IN ('LIMIT', 'MARKET')),
    price NUMERIC(38, 18),
    original_quantity NUMERIC(38, 18) NOT NULL CHECK (original_quantity > 0),
    remaining_quantity NUMERIC(38, 18) NOT NULL CHECK (
        remaining_quantity >= 0 AND remaining_quantity <= original_quantity
    ),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT orders_price_matches_type CHECK (
        (order_type = 'LIMIT' AND price IS NOT NULL AND price > 0)
        OR (order_type = 'MARKET' AND price IS NULL)
    ),
    CONSTRAINT orders_status_matches_remaining CHECK (
        (status = 'PENDING' AND remaining_quantity > 0)
        OR (status = 'FILLED' AND remaining_quantity = 0)
        OR status = 'CANCELLED'
    ),
    CONSTRAINT orders_id_pair_unique UNIQUE (id, trading_pair_id)
);

CREATE INDEX orders_user_pair_status_idx
    ON orders (user_id, trading_pair_id, status);

CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    trading_pair_id TEXT NOT NULL REFERENCES trading_pairs(id),
    buy_order_id TEXT NOT NULL,
    sell_order_id TEXT NOT NULL,
    execution_price NUMERIC(38, 18) NOT NULL CHECK (execution_price > 0),
    execution_quantity NUMERIC(38, 18) NOT NULL CHECK (execution_quantity > 0),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trades_distinct_orders CHECK (buy_order_id <> sell_order_id),
    CONSTRAINT trades_buy_order_pair_fk
        FOREIGN KEY (buy_order_id, trading_pair_id) REFERENCES orders(id, trading_pair_id),
    CONSTRAINT trades_sell_order_pair_fk
        FOREIGN KEY (sell_order_id, trading_pair_id) REFERENCES orders(id, trading_pair_id)
);

CREATE INDEX trades_pair_time_idx
    ON trades (trading_pair_id, executed_at DESC);

CREATE TABLE settlements (
    id TEXT PRIMARY KEY,
    trade_id TEXT REFERENCES trades(id),
    chain_id BIGINT NOT NULL,
    transaction_hash TEXT,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX settlements_trade_status_idx
    ON settlements (trade_id, status);
CREATE INDEX settlements_transaction_hash_idx
    ON settlements (transaction_hash)
    WHERE transaction_hash IS NOT NULL;

CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_events_entity_time_idx
    ON audit_events (entity_type, entity_id, created_at DESC);

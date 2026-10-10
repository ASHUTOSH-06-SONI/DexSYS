use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;
use sqlx::{PgPool, Postgres, Row, Transaction};

use crate::{
    order::{Order, OrderSide, OrderStatus, OrderType},
    token::TokenInfo,
};

static EVENT_ID_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum RepositoryError {
    Database(sqlx::Error),
    InvalidFinancialValue(&'static str),
    NotFound,
    InvalidTransition,
}

impl From<sqlx::Error> for RepositoryError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

#[derive(Debug, Clone)]
pub struct TradingPair {
    pub id: String,
    pub base_token_id: String,
    pub quote_token_id: String,
    pub active: bool,
    pub approved: bool,
}

#[derive(Debug, Clone)]
pub struct TradeRecord {
    pub id: String,
    pub trading_pair_id: String,
    pub buy_order_id: String,
    pub sell_order_id: String,
    pub execution_price: String,
    pub execution_quantity: String,
}

#[derive(Debug, Clone)]
pub struct RestingOrder {
    pub id: String,
    pub user_id: String,
    pub trading_pair: String,
    pub side: String,
    pub price: String,
    pub remaining_quantity: String,
}

#[derive(Debug, Clone)]
pub struct EngineOrderUpdate {
    pub id: String,
    pub remaining_quantity: String,
    pub status: OrderStatus,
}

#[derive(Debug, Clone)]
pub struct ExecutionWrite {
    pub id: String,
    pub trading_pair_id: String,
    pub buy_order_id: String,
    pub sell_order_id: String,
    pub execution_price: String,
    pub execution_quantity: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettlementStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

impl SettlementStatus {
    fn as_db(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Submitted => "SUBMITTED",
            Self::Confirmed => "CONFIRMED",
            Self::Failed => "FAILED",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Settlement {
    pub id: String,
    pub trade_id: Option<String>,
    pub chain_id: i64,
    pub transaction_hash: Option<String>,
    pub status: SettlementStatus,
}

#[derive(Debug, Clone)]
pub struct AuditEvent {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub event_type: String,
    pub metadata: Value,
}

pub async fn create_token(pool: &PgPool, token: &TokenInfo) -> Result<(), RepositoryError> {
    let price = f64_to_numeric(token.price)?;
    let change_24h = f64_to_numeric(token.change_24h)?;
    let balance = f64_to_numeric(token.balance)?;
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO tokens
         (id, symbol, name, contract_address, validated, price, change_24h, balance, supported_pairs)
         VALUES ($1, $1, $2, $3, $4, $5::NUMERIC, $6::NUMERIC, $7::NUMERIC, $8)",
    )
    .bind(&token.symbol)
    .bind(&token.name)
    .bind(&token.contract_address)
    .bind(token.validated)
    .bind(price)
    .bind(change_24h)
    .bind(balance)
    .bind(&token.supported_pairs)
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        "token",
        &token.symbol,
        "TOKEN_CREATED",
        serde_json::json!({"symbol": token.symbol}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn get_token(pool: &PgPool, symbol: &str) -> Result<TokenInfo, RepositoryError> {
    let row = sqlx::query(
        "SELECT symbol, name, validated, price::TEXT AS price,
                change_24h::TEXT AS change_24h, balance::TEXT AS balance,
                contract_address, supported_pairs
         FROM tokens WHERE symbol = $1",
    )
    .bind(symbol)
    .fetch_optional(pool)
    .await?
    .ok_or(RepositoryError::NotFound)?;
    token_from_row(&row)
}

pub async fn list_tokens(pool: &PgPool) -> Result<Vec<TokenInfo>, RepositoryError> {
    let rows = sqlx::query(
        "SELECT symbol, name, validated, price::TEXT AS price,
                change_24h::TEXT AS change_24h, balance::TEXT AS balance,
                contract_address, supported_pairs
         FROM tokens ORDER BY symbol",
    )
    .fetch_all(pool)
    .await?;
    rows.iter().map(token_from_row).collect()
}

pub async fn create_trading_pair(pool: &PgPool, pair: &TradingPair) -> Result<(), RepositoryError> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO trading_pairs (id, base_token_id, quote_token_id, active, approved)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&pair.id)
    .bind(&pair.base_token_id)
    .bind(&pair.quote_token_id)
    .bind(pair.active)
    .bind(pair.approved)
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        "trading_pair",
        &pair.id,
        "TRADING_PAIR_CREATED",
        serde_json::json!({"active": pair.active, "approved": pair.approved}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn list_trading_pairs(pool: &PgPool) -> Result<Vec<TradingPair>, RepositoryError> {
    let rows = sqlx::query(
        "SELECT id, base_token_id, quote_token_id, active, approved
         FROM trading_pairs ORDER BY id",
    )
    .fetch_all(pool)
    .await?;
    rows.iter()
        .map(|row| {
            Ok(TradingPair {
                id: row.try_get("id")?,
                base_token_id: row.try_get("base_token_id")?,
                quote_token_id: row.try_get("quote_token_id")?,
                active: row.try_get("active")?,
                approved: row.try_get("approved")?,
            })
        })
        .collect()
}

pub async fn create_order(pool: &PgPool, order: &Order) -> Result<(), RepositoryError> {
    let price = order.price.map(f64_to_numeric).transpose()?;
    let quantity = f64_to_numeric(order.quantity)?;
    let side = match order.side {
        OrderSide::Buy => "BUY",
        OrderSide::Sell => "SELL",
    };
    let order_type = match order.order_type {
        OrderType::Limit => "LIMIT",
        OrderType::Market => "MARKET",
    };
    let status = order_status_to_db(&order.status);
    let mut transaction = pool.begin().await?;
    let pair_is_available: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM trading_pairs
            WHERE id = $1 AND active = TRUE AND approved = TRUE
         )",
    )
    .bind(&order.trading_pair)
    .fetch_one(&mut *transaction)
    .await?;
    if !pair_is_available {
        transaction.rollback().await?;
        return Err(RepositoryError::InvalidFinancialValue(
            "order pair must exist, be active, and be approved",
        ));
    }
    sqlx::query(
        "INSERT INTO orders
         (id, user_id, trading_pair_id, side, order_type, price, original_quantity,
          remaining_quantity, status)
         VALUES ($1, $2, $3, $4, $5, $6::NUMERIC, $7::NUMERIC, $7::NUMERIC, $8)",
    )
    .bind(&order.id)
    .bind(&order.user_id)
    .bind(&order.trading_pair)
    .bind(side)
    .bind(order_type)
    .bind(price)
    .bind(quantity)
    .bind(status)
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        "order",
        &order.id,
        "ORDER_CREATED",
        serde_json::json!({"status": status}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn get_order(pool: &PgPool, id: &str) -> Result<Order, RepositoryError> {
    let row = sqlx::query(
        "SELECT id, user_id, trading_pair_id, side, order_type, price::TEXT AS price,
                original_quantity::TEXT AS quantity, status
         FROM orders WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(RepositoryError::NotFound)?;
    order_from_row(&row)
}

pub async fn list_orders(pool: &PgPool) -> Result<Vec<Order>, RepositoryError> {
    let rows = sqlx::query(
        "SELECT id, user_id, trading_pair_id, side, order_type, price::TEXT AS price,
                original_quantity::TEXT AS quantity, status
         FROM orders ORDER BY created_at, id",
    )
    .fetch_all(pool)
    .await?;
    rows.iter().map(order_from_row).collect()
}

pub async fn list_resting_orders(pool: &PgPool) -> Result<Vec<RestingOrder>, RepositoryError> {
    let rows = sqlx::query(
        "SELECT id, user_id, trading_pair_id, side, price::TEXT AS price,
                remaining_quantity::TEXT AS remaining_quantity
         FROM orders
         WHERE status = 'PENDING' AND order_type = 'LIMIT'
         ORDER BY trading_pair_id, priority_sequence",
    )
    .fetch_all(pool)
    .await?;
    rows.iter()
        .map(|row| {
            Ok(RestingOrder {
                id: row.try_get("id")?,
                user_id: row.try_get("user_id")?,
                trading_pair: row.try_get("trading_pair_id")?,
                side: row.try_get("side")?,
                price: row.try_get("price")?,
                remaining_quantity: row.try_get("remaining_quantity")?,
            })
        })
        .collect()
}

pub async fn persist_matching_result(
    pool: &PgPool,
    order: &Order,
    incoming_remaining: &str,
    incoming_status: &OrderStatus,
    maker_updates: &[EngineOrderUpdate],
    executions: &[ExecutionWrite],
) -> Result<(), RepositoryError> {
    let incoming_remaining = decimal_string_to_numeric(incoming_remaining)?;
    let mut transaction = pool.begin().await?;
    let pair_is_available: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM trading_pairs
            WHERE id = $1 AND active = TRUE AND approved = TRUE
         )",
    )
    .bind(&order.trading_pair)
    .fetch_one(&mut *transaction)
    .await?;
    if !pair_is_available {
        transaction.rollback().await?;
        return Err(RepositoryError::InvalidFinancialValue(
            "order pair must exist, be active, and be approved",
        ));
    }
    insert_order(&mut transaction, order).await?;
    for maker in maker_updates {
        let remaining = decimal_string_to_numeric(&maker.remaining_quantity)?;
        let status = order_status_to_db(&maker.status);
        let result = sqlx::query(
            "UPDATE orders
             SET remaining_quantity = $2::NUMERIC, status = $3, updated_at = NOW()
             WHERE id = $1 AND status = 'PENDING'",
        )
        .bind(&maker.id)
        .bind(remaining)
        .bind(status)
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() != 1 {
            transaction.rollback().await?;
            return Err(RepositoryError::InvalidTransition);
        }
        insert_audit(
            &mut transaction,
            "order",
            &maker.id,
            "ORDER_MATCHED",
            serde_json::json!({
                "status": status,
                "remaining_quantity": maker.remaining_quantity
            }),
        )
        .await?;
    }
    let incoming_status = order_status_to_db(incoming_status);
    let update = sqlx::query(
        "UPDATE orders
         SET remaining_quantity = $2::NUMERIC, status = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'",
    )
    .bind(&order.id)
    .bind(&incoming_remaining)
    .bind(incoming_status)
    .execute(&mut *transaction)
    .await?;
    if update.rows_affected() != 1 {
        transaction.rollback().await?;
        return Err(RepositoryError::InvalidTransition);
    }
    for execution in executions {
        let price = decimal_string_to_numeric(&execution.execution_price)?;
        let quantity = decimal_string_to_numeric(&execution.execution_quantity)?;
        let valid_orders: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM orders buy
                JOIN orders sell ON sell.trading_pair_id = buy.trading_pair_id
                WHERE buy.id = $1 AND buy.side = 'BUY'
                  AND sell.id = $2 AND sell.side = 'SELL'
                  AND buy.trading_pair_id = $3
             )",
        )
        .bind(&execution.buy_order_id)
        .bind(&execution.sell_order_id)
        .bind(&execution.trading_pair_id)
        .fetch_one(&mut *transaction)
        .await?;
        if !valid_orders {
            transaction.rollback().await?;
            return Err(RepositoryError::InvalidFinancialValue(
                "execution orders must exist, have opposing sides, and belong to the pair",
            ));
        }
        sqlx::query(
            "INSERT INTO trades
             (id, trading_pair_id, buy_order_id, sell_order_id,
              execution_price, execution_quantity)
             VALUES ($1, $2, $3, $4, $5::NUMERIC, $6::NUMERIC)",
        )
        .bind(&execution.id)
        .bind(&execution.trading_pair_id)
        .bind(&execution.buy_order_id)
        .bind(&execution.sell_order_id)
        .bind(price)
        .bind(quantity)
        .execute(&mut *transaction)
        .await?;
        insert_audit(
            &mut transaction,
            "trade",
            &execution.id,
            "TRADE_PERSISTED",
            serde_json::json!({"trading_pair_id": execution.trading_pair_id}),
        )
        .await?;
    }
    insert_audit(
        &mut transaction,
        "order",
        &order.id,
        "ORDER_MATCHED",
        serde_json::json!({
            "status": incoming_status,
            "remaining_quantity": incoming_remaining
        }),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

async fn insert_order(
    transaction: &mut Transaction<'_, Postgres>,
    order: &Order,
) -> Result<(), RepositoryError> {
    let price = order.price.map(f64_to_numeric).transpose()?;
    let quantity = f64_to_numeric(order.quantity)?;
    let side = match order.side {
        OrderSide::Buy => "BUY",
        OrderSide::Sell => "SELL",
    };
    let order_type = match order.order_type {
        OrderType::Limit => "LIMIT",
        OrderType::Market => "MARKET",
    };
    sqlx::query(
        "INSERT INTO orders
         (id, user_id, trading_pair_id, side, order_type, price, original_quantity,
          remaining_quantity, status)
         VALUES ($1, $2, $3, $4, $5, $6::NUMERIC, $7::NUMERIC, $7::NUMERIC, 'PENDING')",
    )
    .bind(&order.id)
    .bind(&order.user_id)
    .bind(&order.trading_pair)
    .bind(side)
    .bind(order_type)
    .bind(price)
    .bind(quantity)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

pub async fn update_order_status(
    pool: &PgPool,
    id: &str,
    status: OrderStatus,
) -> Result<(), RepositoryError> {
    let status = order_status_to_db(&status);
    let mut transaction = pool.begin().await?;
    let update = sqlx::query(
        "UPDATE orders SET status = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'",
    )
    .bind(id)
    .bind(status)
    .execute(&mut *transaction)
    .await?;
    if update.rows_affected() == 0 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1)")
            .bind(id)
            .fetch_one(&mut *transaction)
            .await?;
        transaction.rollback().await?;
        return Err(if exists {
            RepositoryError::InvalidTransition
        } else {
            RepositoryError::NotFound
        });
    }
    insert_audit(
        &mut transaction,
        "order",
        id,
        "ORDER_STATUS_UPDATED",
        serde_json::json!({"status": status}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn update_order_remaining_quantity(
    pool: &PgPool,
    id: &str,
    remaining: f64,
    status: OrderStatus,
) -> Result<(), RepositoryError> {
    let remaining = f64_to_numeric(remaining)?;
    let status = order_status_to_db(&status);
    let mut transaction = pool.begin().await?;
    let update = sqlx::query(
        "UPDATE orders SET remaining_quantity = $2::NUMERIC, status = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING' AND $2::NUMERIC <= original_quantity",
    )
    .bind(id)
    .bind(&remaining)
    .bind(status)
    .execute(&mut *transaction)
    .await?;
    if update.rows_affected() == 0 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1)")
            .bind(id)
            .fetch_one(&mut *transaction)
            .await?;
        transaction.rollback().await?;
        return Err(if exists {
            RepositoryError::InvalidTransition
        } else {
            RepositoryError::NotFound
        });
    }
    insert_audit(
        &mut transaction,
        "order",
        id,
        "ORDER_REMAINING_QUANTITY_UPDATED",
        serde_json::json!({"remaining_quantity": remaining, "status": status}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn create_trade(pool: &PgPool, trade: &TradeRecord) -> Result<(), RepositoryError> {
    let price = decimal_string_to_numeric(&trade.execution_price)?;
    let quantity = decimal_string_to_numeric(&trade.execution_quantity)?;
    let mut transaction = pool.begin().await?;
    let valid_orders: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM orders buy
            JOIN orders sell ON sell.trading_pair_id = buy.trading_pair_id
            WHERE buy.id = $1 AND buy.side = 'BUY'
              AND sell.id = $2 AND sell.side = 'SELL'
              AND buy.trading_pair_id = $3
         )",
    )
    .bind(&trade.buy_order_id)
    .bind(&trade.sell_order_id)
    .bind(&trade.trading_pair_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !valid_orders {
        transaction.rollback().await?;
        return Err(RepositoryError::InvalidFinancialValue(
            "trade orders must exist, have opposing sides, and belong to the specified pair",
        ));
    }
    sqlx::query(
        "INSERT INTO trades
         (id, trading_pair_id, buy_order_id, sell_order_id, execution_price, execution_quantity)
         VALUES ($1, $2, $3, $4, $5::NUMERIC, $6::NUMERIC)",
    )
    .bind(&trade.id)
    .bind(&trade.trading_pair_id)
    .bind(&trade.buy_order_id)
    .bind(&trade.sell_order_id)
    .bind(price)
    .bind(quantity)
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        "trade",
        &trade.id,
        "TRADE_PERSISTED",
        serde_json::json!({"trading_pair_id": trade.trading_pair_id}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn get_trade_history(
    pool: &PgPool,
    trading_pair_id: &str,
    limit: i64,
) -> Result<Vec<TradeRecord>, RepositoryError> {
    let rows = sqlx::query(
        "SELECT id, trading_pair_id, buy_order_id, sell_order_id,
                execution_price::TEXT AS execution_price,
                execution_quantity::TEXT AS execution_quantity
         FROM trades WHERE trading_pair_id = $1
         ORDER BY executed_at DESC LIMIT $2",
    )
    .bind(trading_pair_id)
    .bind(limit.clamp(1, 1000))
    .fetch_all(pool)
    .await?;
    rows.iter()
        .map(|row| {
            Ok(TradeRecord {
                id: row.try_get("id")?,
                trading_pair_id: row.try_get("trading_pair_id")?,
                buy_order_id: row.try_get("buy_order_id")?,
                sell_order_id: row.try_get("sell_order_id")?,
                execution_price: row.try_get("execution_price")?,
                execution_quantity: row.try_get("execution_quantity")?,
            })
        })
        .collect()
}

pub async fn create_settlement(
    pool: &PgPool,
    settlement: &Settlement,
) -> Result<(), RepositoryError> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO settlements (id, trade_id, chain_id, transaction_hash, status)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&settlement.id)
    .bind(&settlement.trade_id)
    .bind(settlement.chain_id)
    .bind(&settlement.transaction_hash)
    .bind(settlement.status.as_db())
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        "settlement",
        &settlement.id,
        "SETTLEMENT_CREATED",
        serde_json::json!({"status": settlement.status.as_db()}),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn update_settlement(
    pool: &PgPool,
    id: &str,
    transaction_hash: Option<&str>,
    status: SettlementStatus,
) -> Result<(), RepositoryError> {
    let mut transaction = pool.begin().await?;
    let update = sqlx::query(
        "UPDATE settlements
         SET transaction_hash = $2, status = $3, updated_at = NOW()
         WHERE id = $1",
    )
    .bind(id)
    .bind(transaction_hash)
    .bind(status.as_db())
    .execute(&mut *transaction)
    .await?;
    if update.rows_affected() == 0 {
        transaction.rollback().await?;
        return Err(RepositoryError::NotFound);
    }
    insert_audit(
        &mut transaction,
        "settlement",
        id,
        "SETTLEMENT_UPDATED",
        serde_json::json!({
            "status": status.as_db(),
            "transaction_hash": transaction_hash
        }),
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn record_audit_event(pool: &PgPool, event: &AuditEvent) -> Result<(), RepositoryError> {
    sqlx::query(
        "INSERT INTO audit_events (id, entity_type, entity_id, event_type, metadata)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&event.id)
    .bind(&event.entity_type)
    .bind(&event.entity_id)
    .bind(&event.event_type)
    .bind(&event.metadata)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn seed_demo_data(pool: &PgPool) -> Result<(), RepositoryError> {
    let seeds = [
        TokenInfo {
            symbol: "ETH".into(),
            name: "Ethereum".into(),
            validated: true,
            price: 3500.0,
            change_24h: 2.4,
            balance: 1.25,
            contract_address: "0x...".into(),
            supported_pairs: vec!["USDC".into(), "WBTC".into()],
        },
        TokenInfo {
            symbol: "BTC".into(),
            name: "Bitcoin".into(),
            validated: true,
            price: 75800.0,
            change_24h: 3.4,
            balance: 0.5,
            contract_address: "0x...".into(),
            supported_pairs: vec!["USDC".into(), "ETH".into()],
        },
    ];
    let mut transaction = pool.begin().await?;
    for token in &seeds {
        sqlx::query(
            "INSERT INTO tokens
             (id, symbol, name, contract_address, validated, price, change_24h, balance, supported_pairs)
             VALUES ($1, $1, $2, $3, $4, $5::NUMERIC, $6::NUMERIC, $7::NUMERIC, $8)
             ON CONFLICT (symbol) DO NOTHING",
        )
        .bind(&token.symbol)
        .bind(&token.name)
        .bind(&token.contract_address)
        .bind(token.validated)
        .bind(f64_to_numeric(token.price)?)
        .bind(f64_to_numeric(token.change_24h)?)
        .bind(f64_to_numeric(token.balance)?)
        .bind(&token.supported_pairs)
        .execute(&mut *transaction)
        .await?;
    }
    for (base, quote) in [("ETH", "BTC"), ("BTC", "ETH")] {
        let pair_id = format!("{base}/{quote}");
        sqlx::query(
            "INSERT INTO trading_pairs (id, base_token_id, quote_token_id, active, approved)
             VALUES ($1, $2, $3, TRUE, TRUE)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(pair_id)
        .bind(base)
        .bind(quote)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(())
}

fn token_from_row(row: &sqlx::postgres::PgRow) -> Result<TokenInfo, RepositoryError> {
    Ok(TokenInfo {
        symbol: row.try_get("symbol")?,
        name: row.try_get("name")?,
        validated: row.try_get("validated")?,
        price: numeric_to_f64(row.try_get("price")?)?,
        change_24h: numeric_to_f64(row.try_get("change_24h")?)?,
        balance: numeric_to_f64(row.try_get("balance")?)?,
        contract_address: row
            .try_get::<Option<String>, _>("contract_address")?
            .unwrap_or_default(),
        supported_pairs: row.try_get("supported_pairs")?,
    })
}

fn order_from_row(row: &sqlx::postgres::PgRow) -> Result<Order, RepositoryError> {
    let side = match row.try_get::<String, _>("side")?.as_str() {
        "BUY" => OrderSide::Buy,
        "SELL" => OrderSide::Sell,
        _ => {
            return Err(RepositoryError::InvalidFinancialValue(
                "invalid stored order side",
            ));
        }
    };
    let order_type = match row.try_get::<String, _>("order_type")?.as_str() {
        "LIMIT" => OrderType::Limit,
        "MARKET" => OrderType::Market,
        _ => {
            return Err(RepositoryError::InvalidFinancialValue(
                "invalid stored order type",
            ));
        }
    };
    let status = match row.try_get::<String, _>("status")?.as_str() {
        "PENDING" => OrderStatus::Pending,
        "FILLED" => OrderStatus::Filled,
        "CANCELLED" => OrderStatus::Cancelled,
        _ => {
            return Err(RepositoryError::InvalidFinancialValue(
                "invalid stored order status",
            ));
        }
    };
    let price: Option<String> = row.try_get("price")?;
    Ok(Order {
        id: row.try_get("id")?,
        user_id: row.try_get("user_id")?,
        trading_pair: row.try_get("trading_pair_id")?,
        side,
        order_type,
        price: price.map(numeric_to_f64).transpose()?,
        quantity: numeric_to_f64(row.try_get("quantity")?)?,
        status,
    })
}

fn order_status_to_db(status: &OrderStatus) -> &'static str {
    match status {
        OrderStatus::Pending => "PENDING",
        OrderStatus::Filled => "FILLED",
        OrderStatus::Cancelled => "CANCELLED",
    }
}

async fn insert_audit(
    transaction: &mut Transaction<'_, Postgres>,
    entity_type: &str,
    entity_id: &str,
    event_type: &str,
    metadata: Value,
) -> Result<(), RepositoryError> {
    let id = next_id("audit");
    sqlx::query(
        "INSERT INTO audit_events (id, entity_type, entity_id, event_type, metadata)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(event_type)
    .bind(metadata)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn next_id(prefix: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos();
    let sequence = EVENT_ID_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}:{timestamp}:{sequence}")
}

fn f64_to_numeric(value: f64) -> Result<String, RepositoryError> {
    if !value.is_finite() {
        return Err(RepositoryError::InvalidFinancialValue(
            "financial values must be finite",
        ));
    }
    let text = value.to_string();
    let canonical = canonical_decimal(&text)?;
    let (integer, fraction) = canonical
        .trim_start_matches('-')
        .split_once('.')
        .unwrap_or((canonical.trim_start_matches('-'), ""));
    let integer_digits = integer.trim_start_matches('0').len();
    if integer_digits > 20 || fraction.len() > 18 {
        return Err(RepositoryError::InvalidFinancialValue(
            "value exceeds NUMERIC(38,18) precision",
        ));
    }
    Ok(canonical)
}

fn decimal_string_to_numeric(value: &str) -> Result<String, RepositoryError> {
    let canonical = canonical_decimal(value)?;
    let (integer, fraction) = canonical
        .trim_start_matches('-')
        .split_once('.')
        .unwrap_or((canonical.trim_start_matches('-'), ""));
    if integer.trim_start_matches('0').len() > 20 || fraction.len() > 18 {
        return Err(RepositoryError::InvalidFinancialValue(
            "value exceeds NUMERIC(38,18) precision",
        ));
    }
    Ok(canonical)
}

fn numeric_to_f64(value: String) -> Result<f64, RepositoryError> {
    let parsed = value
        .parse::<f64>()
        .map_err(|_| RepositoryError::InvalidFinancialValue("invalid stored numeric value"))?;
    if !parsed.is_finite() || canonical_decimal(&parsed.to_string())? != canonical_decimal(&value)?
    {
        return Err(RepositoryError::InvalidFinancialValue(
            "stored numeric value cannot be represented exactly by the API number format",
        ));
    }
    Ok(parsed)
}

fn canonical_decimal(value: &str) -> Result<String, RepositoryError> {
    let (mantissa, exponent) = match value.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (
            mantissa,
            exponent
                .parse::<i32>()
                .map_err(|_| RepositoryError::InvalidFinancialValue("invalid decimal exponent"))?,
        ),
        None => (value, 0),
    };
    if !(-64..=64).contains(&exponent) {
        return Err(RepositoryError::InvalidFinancialValue(
            "decimal exponent exceeds supported bounds",
        ));
    }
    let (negative, unsigned) = match mantissa.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, mantissa.strip_prefix('+').unwrap_or(mantissa)),
    };
    let (whole, fractional) = unsigned.split_once('.').unwrap_or((unsigned, ""));
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fractional.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(RepositoryError::InvalidFinancialValue(
            "invalid decimal value",
        ));
    }
    let digits = format!("{whole}{fractional}");
    let decimal_position = i32::try_from(whole.len())
        .map_err(|_| RepositoryError::InvalidFinancialValue("decimal value is too large"))?
        .checked_add(exponent)
        .ok_or(RepositoryError::InvalidFinancialValue(
            "decimal value is too large",
        ))?;
    let expanded = if decimal_position <= 0 {
        format!(
            "0.{}{}",
            "0".repeat(decimal_position.unsigned_abs() as usize),
            digits
        )
    } else if decimal_position as usize >= digits.len() {
        format!(
            "{}{}",
            digits,
            "0".repeat(decimal_position as usize - digits.len())
        )
    } else {
        let position = decimal_position as usize;
        format!("{}.{}", &digits[..position], &digits[position..])
    };
    let (whole, fractional) = expanded.split_once('.').unwrap_or((&expanded, ""));
    let whole = whole.trim_start_matches('0');
    let whole = if whole.is_empty() { "0" } else { whole };
    let fractional = fractional.trim_end_matches('0');
    let is_zero = whole == "0" && fractional.is_empty();
    let sign = if negative && !is_zero { "-" } else { "" };
    if fractional.is_empty() {
        Ok(format!("{sign}{whole}"))
    } else {
        Ok(format!("{sign}{whole}.{fractional}"))
    }
}

#[cfg(test)]
mod numeric_tests {
    use super::*;

    #[test]
    fn api_numbers_round_trip_without_decimal_rounding() {
        for value in [0.1, 3500.0, 0.000_000_000_000_000_001, -2.4] {
            let encoded = f64_to_numeric(value).unwrap();
            assert_eq!(
                numeric_to_f64(encoded).unwrap().to_string(),
                value.to_string()
            );
        }
    }

    #[test]
    fn rejects_non_finite_and_out_of_range_values() {
        assert!(f64_to_numeric(f64::NAN).is_err());
        assert!(f64_to_numeric(f64::INFINITY).is_err());
        assert!(f64_to_numeric(1e21).is_err());
        assert!(f64_to_numeric(1e-19).is_err());
        assert!(decimal_string_to_numeric("0.1234567890123456789").is_err());
    }

    #[test]
    fn rejects_database_values_that_would_round_for_api() {
        assert!(numeric_to_f64("0.100000000000000001".to_owned()).is_err());
        assert_eq!(
            numeric_to_f64("1.250000000000000000".to_owned()).unwrap(),
            1.25
        );
    }

    #[test]
    fn canonical_decimal_expands_exponents_and_rejects_malformed_values() {
        assert_eq!(canonical_decimal("1.25e-3").unwrap(), "0.00125");
        assert_eq!(canonical_decimal("1e3").unwrap(), "1000");
        assert!(canonical_decimal("NaN").is_err());
        assert!(canonical_decimal("1.2.3").is_err());
    }
}

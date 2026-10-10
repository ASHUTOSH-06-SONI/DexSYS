use std::{env, time::SystemTime};

use api::{
    db,
    matching::{ENGINE_PRICE_SCALE, ENGINE_QUANTITY_SCALE},
    order::{Order, OrderSide, OrderStatus, OrderType},
    repository::{
        self, AuditEvent, RepositoryError, Settlement, SettlementStatus, TradeRecord, TradingPair,
    },
    routes,
    state::AppState,
    token::TokenInfo,
};
use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use sqlx::{Row, postgres::PgPoolOptions};
use tower::ServiceExt;

fn test_database_url() -> String {
    let url = env::var("DEXSYS_TEST_DATABASE_URL")
        .expect("DEXSYS_TEST_DATABASE_URL must point to an isolated test database");
    let database_name = url
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default();
    assert!(
        database_name.ends_with("_test"),
        "refusing integration tests unless database name ends in _test"
    );
    url
}

fn unique_suffix() -> String {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos()
        .to_string()
}

fn limit_order(id: &str, pair: &str, side: OrderSide, price: f64, quantity: f64) -> Order {
    Order {
        id: id.to_owned(),
        user_id: format!("test-user-{id}"),
        trading_pair: pair.to_owned(),
        side,
        order_type: OrderType::Limit,
        price: Some(price),
        quantity,
        status: OrderStatus::Pending,
    }
}

async fn submit_order(app: &axum::Router, order: &Order) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/orders")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(order).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json = if body.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&body).unwrap()
    };
    (status, json)
}

async fn stored_order(pool: &sqlx::PgPool, id: &str) -> (String, f64) {
    let row = sqlx::query(
        "SELECT status, remaining_quantity::TEXT AS remaining_quantity
         FROM orders WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .unwrap();
    (
        row.try_get("status").unwrap(),
        row.try_get::<String, _>("remaining_quantity")
            .unwrap()
            .parse()
            .unwrap(),
    )
}

#[tokio::test]
#[ignore = "requires DEXSYS_TEST_DATABASE_URL pointing to a dedicated database ending in _test"]
async fn postgres_persistence_and_api_lifecycle() {
    let url = test_database_url();
    let pool = db::connect(&url)
        .await
        .expect("connect to isolated test database");
    sqlx::migrate!("../../migrations")
        .run(&pool)
        .await
        .expect("apply SQLx migrations");
    repository::seed_demo_data(&pool)
        .await
        .expect("seed demo data without overwriting existing rows");

    let token = repository::get_token(&pool, "ETH")
        .await
        .expect("retrieve seeded ETH metadata");
    assert_eq!(token.symbol, "ETH");
    assert!(token.validated);
    assert_eq!(token.price, 3500.0);

    let app = routes::router().with_state(AppState::new(pool.clone()));
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/tokens/ETH")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let token_json: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(token_json["symbol"], "ETH");
    assert_eq!(token_json["price"], 3500.0);

    let missing_token = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/tokens/DEXSYS-UNKNOWN")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(missing_token.status(), StatusCode::NOT_FOUND);

    let suffix = unique_suffix();
    let symbol = format!("T{suffix}");
    let pair_id = format!("{symbol}/ETH");
    let test_token = TokenInfo {
        symbol: symbol.clone(),
        name: "Persistence Test Token".into(),
        validated: true,
        price: 0.1,
        change_24h: -0.1,
        balance: 1.0,
        contract_address: String::new(),
        supported_pairs: vec!["ETH".into()],
    };
    repository::create_token(&pool, &test_token)
        .await
        .expect("insert test token");
    assert!(repository::create_token(&pool, &test_token).await.is_err());
    let pair = TradingPair {
        id: pair_id.clone(),
        base_token_id: symbol.clone(),
        quote_token_id: "ETH".into(),
        active: true,
        approved: true,
    };
    repository::create_trading_pair(&pool, &pair)
        .await
        .expect("insert test trading pair");
    assert!(repository::create_trading_pair(&pool, &pair).await.is_err());
    assert!(
        repository::create_trading_pair(
            &pool,
            &TradingPair {
                id: format!("{symbol}/{symbol}"),
                base_token_id: symbol.clone(),
                quote_token_id: symbol.clone(),
                active: true,
                approved: true,
            },
        )
        .await
        .is_err()
    );
    assert!(
        repository::list_tokens(&pool)
            .await
            .unwrap()
            .iter()
            .any(|item| item.symbol == symbol)
    );
    assert!(
        repository::list_trading_pairs(&pool)
            .await
            .unwrap()
            .iter()
            .any(|item| item.id == pair_id)
    );

    let buy_id = format!("buy-{suffix}");
    let sell_id = format!("sell-{suffix}");
    let buy = limit_order(&buy_id, &pair_id, OrderSide::Buy, 123.45, 1.25);
    let sell = limit_order(&sell_id, &pair_id, OrderSide::Sell, 123.46, 1.25);
    repository::create_order(&pool, &buy)
        .await
        .expect("insert buy order");
    repository::create_order(&pool, &sell)
        .await
        .expect("insert sell order");
    assert!(repository::create_order(&pool, &buy).await.is_err());
    let loaded_order = repository::get_order(&pool, &buy_id)
        .await
        .expect("retrieve order");
    assert_eq!(loaded_order.quantity, 1.25);
    assert_eq!(loaded_order.price, Some(123.45));

    let route_order_id = format!("api-order-{suffix}");
    let request_order = limit_order(&route_order_id, "ETH/BTC", OrderSide::Buy, 10.25, 0.5);
    let (status, response) = submit_order(&app, &request_order).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Pending");
    assert_eq!(response["quantity"], 0.5);

    let fetched = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/orders/{route_order_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(fetched.status(), StatusCode::OK);
    let fetched_json: Value =
        serde_json::from_slice(&to_bytes(fetched.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(fetched_json["trading_pair"], "ETH/BTC");

    let cancelled = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/orders/{route_order_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(cancelled.status(), StatusCode::NO_CONTENT);
    let second_cancel = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/orders/{route_order_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_cancel.status(), StatusCode::CONFLICT);
    assert!(matches!(
        repository::get_order(&pool, &route_order_id)
            .await
            .unwrap()
            .status,
        OrderStatus::Cancelled
    ));

    repository::update_order_remaining_quantity(&pool, &buy_id, 0.25, OrderStatus::Pending)
        .await
        .expect("update remaining quantity");
    assert!(
        repository::update_order_remaining_quantity(&pool, &buy_id, 1.3, OrderStatus::Pending)
            .await
            .is_err()
    );
    let trade = TradeRecord {
        id: format!("trade-{suffix}"),
        trading_pair_id: pair_id.clone(),
        buy_order_id: buy_id.clone(),
        sell_order_id: sell_id.clone(),
        execution_price: "123.450000000000000001".into(),
        execution_quantity: "0.25".into(),
    };
    repository::create_trade(&pool, &trade)
        .await
        .expect("persist execution fixture");
    let persisted_trade = repository::get_trade_history(&pool, &pair_id, 20)
        .await
        .expect("read trade history")
        .into_iter()
        .find(|item| item.id == trade.id)
        .expect("trade present in history");
    assert!(
        persisted_trade
            .execution_price
            .ends_with("123.450000000000000001")
    );
    assert!(
        repository::create_trade(
            &pool,
            &TradeRecord {
                id: format!("invalid-trade-{suffix}"),
                trading_pair_id: "BTC/ETH".into(),
                ..trade.clone()
            }
        )
        .await
        .is_err()
    );

    let settlement_id = format!("settlement-{suffix}");
    repository::create_settlement(
        &pool,
        &Settlement {
            id: settlement_id.clone(),
            trade_id: Some(trade.id.clone()),
            chain_id: 31337,
            transaction_hash: None,
            status: SettlementStatus::Pending,
        },
    )
    .await
    .expect("create settlement");
    repository::update_settlement(
        &pool,
        &settlement_id,
        Some("0xtesttransaction"),
        SettlementStatus::Submitted,
    )
    .await
    .expect("update settlement");
    let settlement_status: String =
        sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1")
            .bind(&settlement_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(settlement_status, "SUBMITTED");
    assert!(
        repository::create_settlement(
            &pool,
            &Settlement {
                id: format!("invalid-settlement-{suffix}"),
                trade_id: Some(format!("unknown-{suffix}")),
                chain_id: 31337,
                transaction_hash: None,
                status: SettlementStatus::Pending,
            },
        )
        .await
        .is_err()
    );
    repository::record_audit_event(
        &pool,
        &AuditEvent {
            id: format!("test-audit-{suffix}"),
            entity_type: "test".into(),
            entity_id: suffix,
            event_type: "TEST_EVENT".into(),
            metadata: json!({"test": true}),
        },
    )
    .await
    .expect("record audit event");

    let closed_pool = PgPoolOptions::new()
        .connect_lazy(&url)
        .expect("parse test database URL");
    closed_pool.close().await;
    assert!(matches!(
        repository::get_token(&closed_pool, "ETH").await,
        Err(RepositoryError::Database(_))
    ));
    pool.close().await;
}

#[tokio::test]
#[ignore = "requires DEXSYS_TEST_DATABASE_URL pointing to a dedicated database ending in _test"]
async fn matching_executions_and_order_states_are_persisted() {
    let url = test_database_url();
    let pool = db::connect(&url)
        .await
        .expect("connect to isolated test database");
    sqlx::migrate!("../../migrations")
        .run(&pool)
        .await
        .expect("apply SQLx migrations");
    repository::seed_demo_data(&pool)
        .await
        .expect("seed demo data");
    let suffix = unique_suffix();
    let token_symbol = format!("M{suffix}");
    let pair = format!("{token_symbol}/ETH");
    repository::create_token(
        &pool,
        &TokenInfo {
            symbol: token_symbol.clone(),
            name: "Matching Test Token".into(),
            validated: true,
            price: 1.0,
            change_24h: 0.0,
            balance: 0.0,
            contract_address: String::new(),
            supported_pairs: vec!["ETH".into()],
        },
    )
    .await
    .expect("create matching test token");
    repository::create_trading_pair(
        &pool,
        &TradingPair {
            id: pair.clone(),
            base_token_id: token_symbol,
            quote_token_id: "ETH".into(),
            active: true,
            approved: true,
        },
    )
    .await
    .expect("create matching test pair");
    let app = routes::router().with_state(
        AppState::restore(pool.clone())
            .await
            .expect("restore persisted limit orders into in-memory books"),
    );

    let resting_sell_id = format!("noncross-sell-{suffix}");
    let noncross_buy_id = format!("noncross-buy-{suffix}");
    let (status, _) = submit_order(
        &app,
        &limit_order(&resting_sell_id, &pair, OrderSide::Sell, 700.0, 1.25),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, response) = submit_order(
        &app,
        &limit_order(&noncross_buy_id, &pair, OrderSide::Buy, 699.0, 0.5),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Pending");
    assert_eq!(
        stored_order(&pool, &resting_sell_id).await,
        ("PENDING".into(), 1.25)
    );
    assert_eq!(
        stored_order(&pool, &noncross_buy_id).await,
        ("PENDING".into(), 0.5)
    );
    let noncross_trade_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM trades WHERE buy_order_id = $1 OR sell_order_id = $1
         OR buy_order_id = $2 OR sell_order_id = $2",
    )
    .bind(&resting_sell_id)
    .bind(&noncross_buy_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(noncross_trade_count, 0);
    for order_id in [&resting_sell_id, &noncross_buy_id] {
        let cancelled = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/orders/{order_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(cancelled.status(), StatusCode::NO_CONTENT);
    }

    let partial_maker_id = format!("partial-maker-{suffix}");
    let partial_taker_id = format!("partial-taker-{suffix}");
    submit_order(
        &app,
        &limit_order(&partial_maker_id, &pair, OrderSide::Sell, 800.0, 1.0),
    )
    .await;
    let partial_taker = limit_order(&partial_taker_id, &pair, OrderSide::Buy, 800.0, 0.4);
    let (status, response) = submit_order(&app, &partial_taker).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Filled");
    assert_eq!(
        stored_order(&pool, &partial_maker_id).await,
        ("PENDING".into(), 0.6)
    );
    assert_eq!(
        stored_order(&pool, &partial_taker_id).await,
        ("FILLED".into(), 0.0)
    );
    let partial_trade = repository::get_trade_history(&pool, &pair, 100)
        .await
        .unwrap()
        .into_iter()
        .find(|trade| {
            trade
                .id
                .starts_with(&format!("{partial_taker_id}:execution:"))
        })
        .expect("partial execution persisted");
    assert_eq!(
        partial_trade.execution_quantity.parse::<f64>().unwrap(),
        0.4
    );
    assert_eq!(partial_trade.execution_price.parse::<f64>().unwrap(), 800.0);
    let cancelled_partial_remainder = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/orders/{partial_maker_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(cancelled_partial_remainder.status(), StatusCode::NO_CONTENT);

    let full_maker_id = format!("full-maker-{suffix}");
    let full_taker_id = format!("full-taker-{suffix}");
    submit_order(
        &app,
        &limit_order(&full_maker_id, &pair, OrderSide::Sell, 900.0, 0.5),
    )
    .await;
    let (status, response) = submit_order(
        &app,
        &limit_order(&full_taker_id, &pair, OrderSide::Buy, 900.0, 0.5),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Filled");
    assert_eq!(
        stored_order(&pool, &full_maker_id).await,
        ("FILLED".into(), 0.0)
    );
    assert_eq!(
        stored_order(&pool, &full_taker_id).await,
        ("FILLED".into(), 0.0)
    );

    let first_maker_id = format!("multi-maker-first-{suffix}");
    let second_maker_id = format!("multi-maker-second-{suffix}");
    let multi_taker_id = format!("multi-taker-{suffix}");
    submit_order(
        &app,
        &limit_order(&first_maker_id, &pair, OrderSide::Sell, 1_000.0, 0.2),
    )
    .await;
    submit_order(
        &app,
        &limit_order(&second_maker_id, &pair, OrderSide::Sell, 1_001.0, 0.3),
    )
    .await;
    let (status, response) = submit_order(
        &app,
        &limit_order(&multi_taker_id, &pair, OrderSide::Buy, 1_001.0, 0.5),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Filled");
    assert_eq!(
        stored_order(&pool, &first_maker_id).await,
        ("FILLED".into(), 0.0)
    );
    assert_eq!(
        stored_order(&pool, &second_maker_id).await,
        ("FILLED".into(), 0.0)
    );
    assert_eq!(
        stored_order(&pool, &multi_taker_id).await,
        ("FILLED".into(), 0.0)
    );
    let multi_execution_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM trades WHERE id LIKE $1")
            .bind(format!("{multi_taker_id}:execution:%"))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(multi_execution_count, 2);
    let maker_sequence: Vec<String> =
        sqlx::query_scalar("SELECT sell_order_id FROM trades WHERE id LIKE $1 ORDER BY id")
            .bind(format!("{multi_taker_id}:execution:%"))
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(maker_sequence, vec![first_maker_id, second_maker_id]);

    let reverse_maker_id = format!("reverse-maker-{suffix}");
    let reverse_taker_id = format!("reverse-taker-{suffix}");
    submit_order(
        &app,
        &limit_order(&reverse_maker_id, &pair, OrderSide::Buy, 1_100.0, 0.3),
    )
    .await;
    let (status, response) = submit_order(
        &app,
        &limit_order(&reverse_taker_id, &pair, OrderSide::Sell, 1_100.0, 0.3),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Filled");
    assert_eq!(
        stored_order(&pool, &reverse_maker_id).await,
        ("FILLED".into(), 0.0)
    );
    assert_eq!(
        stored_order(&pool, &reverse_taker_id).await,
        ("FILLED".into(), 0.0)
    );
    let reverse_trade_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM trades
         WHERE id LIKE $1 AND buy_order_id = $2 AND sell_order_id = $3",
    )
    .bind(format!("{reverse_taker_id}:execution:%"))
    .bind(&reverse_maker_id)
    .bind(&reverse_taker_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(reverse_trade_count, 1);

    let fifo_first_id = format!("z-fifo-first-{suffix}");
    let fifo_second_id = format!("a-fifo-second-{suffix}");
    repository::create_order(
        &pool,
        &limit_order(&fifo_first_id, &pair, OrderSide::Sell, 1_200.0, 0.2),
    )
    .await
    .expect("persist first same-price FIFO order");
    repository::create_order(
        &pool,
        &limit_order(&fifo_second_id, &pair, OrderSide::Sell, 1_200.0, 0.3),
    )
    .await
    .expect("persist second same-price FIFO order");
    let restored_app = routes::router().with_state(
        AppState::restore(pool.clone())
            .await
            .expect("restore the persisted FIFO sequence"),
    );
    let fifo_taker_id = format!("fifo-taker-{suffix}");
    let (status, response) = submit_order(
        &restored_app,
        &limit_order(&fifo_taker_id, &pair, OrderSide::Buy, 1_200.0, 0.25),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(response["status"], "Filled");
    assert_eq!(
        stored_order(&pool, &fifo_first_id).await,
        ("FILLED".into(), 0.0)
    );
    assert_eq!(
        stored_order(&pool, &fifo_second_id).await,
        ("PENDING".into(), 0.25)
    );
    let fifo_execution_sells: Vec<String> =
        sqlx::query_scalar("SELECT sell_order_id FROM trades WHERE id LIKE $1 ORDER BY id")
            .bind(format!("{fifo_taker_id}:execution:%"))
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(fifo_execution_sells, vec![fifo_first_id, fifo_second_id]);

    let market_id = format!("unsupported-market-{suffix}");
    let mut market_order = limit_order(&market_id, &pair, OrderSide::Buy, 0.0, 0.2);
    market_order.order_type = OrderType::Market;
    market_order.price = None;
    let (status, _) = submit_order(&app, &market_order).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let market_records: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM orders WHERE id = $1")
        .bind(&market_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(market_records, 0);

    assert_eq!(ENGINE_PRICE_SCALE, 100);
    assert_eq!(ENGINE_QUANTITY_SCALE, 1_000_000);
    pool.close().await;
}

#[tokio::test]
#[ignore = "requires DEXSYS_TEST_DATABASE_URL pointing to a dedicated database ending in _test"]
async fn matching_persistence_failure_does_not_mutate_live_orderbook() {
    let url = test_database_url();
    let pool = PgPoolOptions::new()
        .connect_lazy(&url)
        .expect("parse isolated test database URL");
    pool.close().await;
    let state = AppState::new(pool);
    let app = routes::router().with_state(state.clone());
    let order_id = format!("failed-persistence-{}", unique_suffix());
    let (status, _) = submit_order(
        &app,
        &limit_order(&order_id, "ETH/BTC", OrderSide::Buy, 1_200.0, 0.3),
    )
    .await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    let engines = state.matching_engines.lock().await;
    let engine = engines.get("ETH/BTC").expect("pair engine was initialized");
    assert!(
        engine
            .orderbook
            .bids
            .values()
            .flat_map(|level| &level.orders)
            .all(|order| order.id != order_id)
    );
}

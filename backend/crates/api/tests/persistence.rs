use std::{env, time::SystemTime};

use api::{
    db,
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
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

fn test_database_url() -> Option<String> {
    env::var("DEXSYS_TEST_DATABASE_URL").ok()
}

fn assert_isolated_test_database(url: &str) {
    let database_name = url
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default();
    assert!(
        database_name.ends_with("_test"),
        "refusing integration tests unless database name ends with _test"
    );
}

fn unique_suffix() -> String {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos()
        .to_string()
}

fn limit_order(id: &str, pair: &str, side: OrderSide, price: f64) -> Order {
    Order {
        id: id.to_owned(),
        user_id: format!("test-user-{id}"),
        trading_pair: pair.to_owned(),
        side,
        order_type: OrderType::Limit,
        price: Some(price),
        quantity: 1.25,
        status: OrderStatus::Pending,
    }
}

#[tokio::test]
#[ignore = "requires DEXSYS_TEST_DATABASE_URL pointing to a dedicated database ending in _test"]
async fn postgres_persistence_and_api_lifecycle() {
    let url = test_database_url().expect("DEXSYS_TEST_DATABASE_URL must be set");
    assert_isolated_test_database(&url);
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
    repository::create_trading_pair(
        &pool,
        &TradingPair {
            id: pair_id.clone(),
            base_token_id: symbol.clone(),
            quote_token_id: "ETH".into(),
            active: true,
            approved: true,
        },
    )
    .await
    .expect("insert test trading pair");
    assert!(
        repository::create_trading_pair(
            &pool,
            &TradingPair {
                id: pair_id.clone(),
                base_token_id: symbol.clone(),
                quote_token_id: "ETH".into(),
                active: true,
                approved: true,
            },
        )
        .await
        .is_err()
    );
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
            .any(|pair| pair.id == pair_id)
    );

    let buy_id = format!("buy-{suffix}");
    let sell_id = format!("sell-{suffix}");
    let buy_order = limit_order(&buy_id, &pair_id, OrderSide::Buy, 123.45);
    let sell_order = limit_order(&sell_id, &pair_id, OrderSide::Sell, 123.46);
    repository::create_order(&pool, &buy_order)
        .await
        .expect("insert buy order");
    repository::create_order(&pool, &sell_order)
        .await
        .expect("insert sell order");
    assert!(repository::create_order(&pool, &buy_order).await.is_err());
    let loaded_order = repository::get_order(&pool, &buy_id)
        .await
        .expect("retrieve order");
    assert_eq!(loaded_order.quantity, 1.25);
    assert_eq!(loaded_order.price, Some(123.45));
    let market_id = format!("market-{suffix}");
    repository::create_order(
        &pool,
        &Order {
            id: market_id.clone(),
            user_id: "test-market-user".into(),
            trading_pair: pair_id.clone(),
            side: OrderSide::Sell,
            order_type: OrderType::Market,
            price: None,
            quantity: 0.5,
            status: OrderStatus::Pending,
        },
    )
    .await
    .expect("insert market order with a null price");
    assert_eq!(
        repository::get_order(&pool, &market_id)
            .await
            .unwrap()
            .price,
        None
    );

    let route_order_id = format!("api-order-{suffix}");
    let order_json = json!({
        "id": route_order_id,
        "user_id": "api-test-user",
        "trading_pair": "ETH/BTC",
        "side": "Buy",
        "order_type": "Limit",
        "price": 10.25,
        "quantity": 0.5,
        "status": "Cancelled"
    });
    let created = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/orders")
                .header("content-type", "application/json")
                .body(Body::from(order_json.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(created.status(), StatusCode::OK);
    let created_json: Value =
        serde_json::from_slice(&to_bytes(created.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(created_json["status"], "Pending");
    assert_eq!(created_json["quantity"], 0.5);

    let listed = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/orders")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(listed.status(), StatusCode::OK);
    let listed_json: Value =
        serde_json::from_slice(&to_bytes(listed.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert!(
        listed_json
            .as_array()
            .unwrap()
            .iter()
            .any(|order| order["id"] == route_order_id)
    );

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
        .expect("read pair trade history")
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
    .expect("update submitted settlement");
    repository::update_settlement(
        &pool,
        &settlement_id,
        Some("0xtesttransaction"),
        SettlementStatus::Confirmed,
    )
    .await
    .expect("update settlement status");
    let settlement_status: String =
        sqlx::query_scalar("SELECT status FROM settlements WHERE id = $1")
            .bind(&settlement_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(settlement_status, "CONFIRMED");
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
    assert!(
        repository::record_audit_event(
            &pool,
            &AuditEvent {
                id: format!("test-audit-{suffix}"),
                entity_type: "test".into(),
                entity_id: suffix.clone(),
                event_type: "TEST_EVENT".into(),
                metadata: json!({"test": true}),
            },
        )
        .await
        .is_ok()
    );

    let closed_pool = PgPoolOptions::new()
        .connect_lazy(&url)
        .expect("parse isolated test database URL");
    closed_pool.close().await;
    assert!(matches!(
        repository::get_token(&closed_pool, "ETH").await,
        Err(RepositoryError::Database(_))
    ));
    assert!(matches!(
        repository::create_order(&closed_pool, &buy_order).await,
        Err(RepositoryError::Database(_))
    ));

    pool.close().await;
}

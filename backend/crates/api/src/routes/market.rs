use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use orderbook::AggregatedLevel;
use serde::Serialize;

use crate::{
    matching::{self, ENGINE_PRICE_SCALE, ENGINE_QUANTITY_SCALE},
    state::AppState,
};

#[derive(Serialize)]
pub struct DepthLevel {
    price: String,
    quantity: String,
    cumulative_quantity: String,
}

#[derive(Serialize)]
pub struct DepthResponse {
    trading_pair: String,
    bids: Vec<DepthLevel>,
    asks: Vec<DepthLevel>,
}

#[derive(Serialize)]
struct DepthError {
    error: &'static str,
}

pub fn router() -> Router<AppState> {
    Router::<AppState>::new().route("/market/depth/{base}/{quote}", get(get_depth))
}

async fn get_depth(
    State(state): State<AppState>,
    Path((base, quote)): Path<(String, String)>,
) -> Result<Json<DepthResponse>, (StatusCode, Json<DepthError>)> {
    if base.is_empty() || quote.is_empty() || base == quote {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(DepthError {
                error: "A valid trading pair is required.",
            }),
        ));
    }

    let trading_pair = format!("{base}/{quote}");
    let engines = state.matching_engines.lock().await;
    let levels = engines
        .get(&trading_pair)
        .map(|engine| {
            Ok::<_, ()>((
                engine.orderbook.aggregated_bids().map_err(|_| ())?,
                engine.orderbook.aggregated_asks().map_err(|_| ())?,
            ))
        })
        .transpose()
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DepthError {
                    error: "Order-book depth is unavailable because the book contains invalid or overflowing quantities.",
                }),
            )
        })?
        .unwrap_or_default();
    drop(engines);

    let bids = serialize_levels(levels.0).map_err(internal_depth_error)?;
    let asks = serialize_levels(levels.1).map_err(internal_depth_error)?;
    Ok(Json(DepthResponse {
        trading_pair,
        bids,
        asks,
    }))
}

fn serialize_levels(levels: Vec<AggregatedLevel>) -> Result<Vec<DepthLevel>, ()> {
    let mut cumulative_quantity = 0_i64;
    levels
        .into_iter()
        .map(|level| {
            cumulative_quantity = cumulative_quantity.checked_add(level.quantity).ok_or(())?;
            Ok(DepthLevel {
                price: matching::engine_scaled_to_decimal(level.price, ENGINE_PRICE_SCALE)?,
                quantity: matching::engine_scaled_to_decimal(
                    level.quantity,
                    ENGINE_QUANTITY_SCALE,
                )?,
                cumulative_quantity: matching::engine_scaled_to_decimal(
                    cumulative_quantity,
                    ENGINE_QUANTITY_SCALE,
                )?,
            })
        })
        .collect()
}

fn internal_depth_error(_: ()) -> (StatusCode, Json<DepthError>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(DepthError {
            error: "Order-book depth could not be represented safely.",
        }),
    )
}

#[cfg(test)]
mod tests {
    use axum::{
        body::{Body, to_bytes},
        http::Request,
    };
    use matching_engine::MatchingEngine;
    use serde_json::{Value, json};
    use shared::{Order, OrderSide, OrderType};
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::*;
    use crate::state::AppState;

    fn test_state() -> AppState {
        let pool = PgPoolOptions::new()
            .connect_lazy("postgres://localhost/dexsys_depth_test")
            .expect("create lazy PostgreSQL pool for isolated route test");
        AppState::new(pool)
    }

    fn add_order(
        engine: &mut MatchingEngine,
        id: &str,
        side: OrderSide,
        price: i64,
        quantity: i64,
    ) {
        engine.orderbook.add_order(Order {
            id: id.to_owned(),
            user_id: "test-user".to_owned(),
            trading_pair: "ETH/BTC".to_owned(),
            side,
            order_type: OrderType::Limit,
            price: Some(price),
            quantity,
        });
    }

    async fn get_depth(state: AppState) -> (StatusCode, Value) {
        let app = router().with_state(state);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/market/depth/ETH/BTC")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        (status, serde_json::from_slice(&body).unwrap())
    }

    #[tokio::test]
    async fn depth_endpoint_returns_aggregated_sorted_fixed_point_levels() {
        let state = test_state();
        {
            let mut engines = state.matching_engines.lock().await;
            let engine = engines
                .entry("ETH/BTC".to_owned())
                .or_insert_with(MatchingEngine::new);
            add_order(engine, "bid-low-a", OrderSide::Buy, 500, 1_250_000);
            add_order(engine, "bid-low-b", OrderSide::Buy, 500, 750_000);
            add_order(engine, "bid-high", OrderSide::Buy, 525, 500_000);
            add_order(engine, "ask-low", OrderSide::Sell, 550, 2_000_000);
            add_order(engine, "ask-high", OrderSide::Sell, 575, 1_000_000);
        }

        let (status, response) = get_depth(state).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            response,
            json!({
                "trading_pair": "ETH/BTC",
                "bids": [
                    {"price": "5.25", "quantity": "0.5", "cumulative_quantity": "0.5"},
                    {"price": "5", "quantity": "2", "cumulative_quantity": "2.5"}
                ],
                "asks": [
                    {"price": "5.5", "quantity": "2", "cumulative_quantity": "2"},
                    {"price": "5.75", "quantity": "1", "cumulative_quantity": "3"}
                ]
            })
        );
    }

    #[tokio::test]
    async fn depth_endpoint_reports_an_empty_uninitialized_book_honestly() {
        let (status, response) = get_depth(test_state()).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            response,
            json!({"trading_pair": "ETH/BTC", "bids": [], "asks": []})
        );
    }

    #[tokio::test]
    async fn depth_endpoint_rejects_invalid_pair() {
        let state = test_state();
        let app = router().with_state(state);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/market/depth/ETH/ETH")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn cumulative_quantity_overflow_is_rejected() {
        assert!(serialize_levels(vec![
            AggregatedLevel {
                price: 500,
                quantity: i64::MAX,
            },
            AggregatedLevel {
                price: 400,
                quantity: 1,
            },
        ])
        .is_err());
    }
}

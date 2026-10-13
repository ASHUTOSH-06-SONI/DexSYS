use axum::{
    Json, Router,
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{delete, get, post},
};
use serde::Deserialize;

use crate::{
    auth::Principal,
    error::OrderError,
    matching::{self, MatchingError},
    order::{Order, OrderStatus},
    repository::{self, RepositoryError},
    state::AppState,
};

#[derive(Deserialize)]
struct CreateOrderRequest {
    id: String,
    trading_pair: String,
    side: crate::order::OrderSide,
    order_type: crate::order::OrderType,
    price: Option<f64>,
    quantity: f64,
}

pub fn router() -> Router<AppState> {
    Router::<AppState>::new()
        .route("/orders", post(create_order))
        .route("/orders/{id}", get(get_order))
        .route("/orders", get(get_orders))
        .route("/orders/{id}", delete(cancel_order))
}

async fn create_order(
    State(state): State<AppState>,
    Extension(principal): Extension<Principal>,
    Json(request): Json<CreateOrderRequest>,
) -> Result<Json<Order>, OrderError> {
    let principal_id =
        repository::get_or_create_principal(&state.pool, &principal.issuer, &principal.subject)
            .await
            .map_err(map_order_error)?;
    let mut order = Order {
        id: request.id,
        user_id: principal_id.to_string(),
        owner_principal_id: Some(principal_id),
        trading_pair: request.trading_pair,
        side: request.side,
        order_type: request.order_type,
        price: request.price,
        quantity: request.quantity,
        status: OrderStatus::Pending,
    };
    order.validate()?;
    matching::engine_order_from_api(&order)?;
    let mut engines = state.matching_engines.lock().await;
    let engine = engines
        .entry(order.trading_pair.clone())
        .or_insert_with(matching_engine::MatchingEngine::new);
    order.status = matching::process_and_persist(&state.pool, engine, &order)
        .await
        .map_err(map_matching_error)?;
    Ok(Json(order))
}

async fn get_order(
    State(state): State<AppState>,
    Extension(principal): Extension<Principal>,
    Path(id): Path<String>,
) -> Result<Json<Order>, OrderError> {
    let principal_id =
        repository::get_principal_id(&state.pool, &principal.issuer, &principal.subject)
            .await
            .map_err(map_order_error)?;
    repository::get_order_for_principal(&state.pool, &id, principal_id)
        .await
        .map(Json)
        .map_err(map_order_error)
}

async fn get_orders(
    State(state): State<AppState>,
    Extension(principal): Extension<Principal>,
) -> Result<Json<Vec<Order>>, OrderError> {
    let principal_id =
        repository::get_principal_id(&state.pool, &principal.issuer, &principal.subject)
            .await
            .map_err(map_order_error)?;
    repository::list_orders_for_principal(&state.pool, principal_id)
        .await
        .map(Json)
        .map_err(map_order_error)
}

async fn cancel_order(
    State(state): State<AppState>,
    Extension(principal): Extension<Principal>,
    Path(id): Path<String>,
) -> Result<StatusCode, OrderError> {
    let principal_id =
        repository::get_principal_id(&state.pool, &principal.issuer, &principal.subject)
            .await
            .map_err(map_order_error)?;
    let order = repository::get_order_for_principal(&state.pool, &id, principal_id)
        .await
        .map_err(map_order_error)?;
    let mut engines = state.matching_engines.lock().await;
    let mut staged_engine = engines.get(&order.trading_pair).cloned();
    if let Some(engine) = staged_engine.as_mut() {
        engine.orderbook.cancel_order(&id);
    }
    repository::update_order_status_for_principal(
        &state.pool,
        &id,
        principal_id,
        OrderStatus::Cancelled,
    )
    .await
    .map_err(map_order_error)?;
    if let Some(engine) = staged_engine {
        engines.insert(order.trading_pair, engine);
    }
    Ok(StatusCode::NO_CONTENT)
}

fn map_matching_error(error: MatchingError) -> OrderError {
    match error {
        MatchingError::InvalidOrder => OrderError::InvalidOrder,
        MatchingError::Persistence(error) => map_order_error(error),
    }
}

fn map_order_error(error: RepositoryError) -> OrderError {
    match error {
        RepositoryError::NotFound => OrderError::NotFound,
        RepositoryError::InvalidTransition => OrderError::InvalidTransition,
        RepositoryError::InvalidFinancialValue(_) => OrderError::InvalidOrder,
        RepositoryError::Database(error) => {
            let mapped = match &error {
                sqlx::Error::Database(database_error)
                    if database_error.code().as_deref() == Some("23505") =>
                {
                    OrderError::AlreadyExists
                }
                sqlx::Error::Database(database_error)
                    if database_error.code().as_deref() == Some("23503") =>
                {
                    OrderError::InvalidOrder
                }
                _ => {
                    eprintln!("Order persistence request failed: {error:?}");
                    OrderError::Internal
                }
            };
            mapped
        }
    }
}

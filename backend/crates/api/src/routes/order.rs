use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
};

use crate::{
    error::OrderError,
    order::{Order, OrderStatus},
    repository::{self, RepositoryError},
    state::AppState,
};

pub fn router() -> Router<AppState> {
    Router::<AppState>::new()
        .route("/orders", post(create_order))
        .route("/orders/{id}", get(get_order))
        .route("/orders", get(get_orders))
        .route("/orders/{id}", delete(cancel_order))
}

async fn create_order(
    State(state): State<AppState>,
    Json(mut order): Json<Order>,
) -> Result<Json<Order>, OrderError> {
    order.validate()?;
    order.status = OrderStatus::Pending;
    repository::create_order(&state.pool, &order)
        .await
        .map_err(map_order_error)?;
    Ok(Json(order))
}

async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Order>, OrderError> {
    repository::get_order(&state.pool, &id)
        .await
        .map(Json)
        .map_err(map_order_error)
}

async fn get_orders(State(state): State<AppState>) -> Result<Json<Vec<Order>>, OrderError> {
    repository::list_orders(&state.pool)
        .await
        .map(Json)
        .map_err(map_order_error)
}

async fn cancel_order(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, OrderError> {
    repository::update_order_status(&state.pool, &id, OrderStatus::Cancelled)
        .await
        .map_err(map_order_error)?;
    Ok(StatusCode::NO_CONTENT)
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

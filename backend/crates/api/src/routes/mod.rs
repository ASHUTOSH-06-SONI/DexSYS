use axum::Router;
use crate::state::AppState;

pub mod health;
pub mod token;
pub mod order;

pub fn router() -> Router<AppState>{
    Router::<AppState>::new()
        .merge(health::router())
        .merge(token::router())
        .merge(order::router())
}
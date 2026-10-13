use axum::Router;
use axum::middleware;

use crate::{auth::Authenticator, state::AppState};

pub mod health;
pub mod order;
pub mod token;

pub fn router(authenticator: Authenticator) -> Router<AppState> {
    Router::<AppState>::new()
        .merge(health::router())
        .merge(token::router())
        .merge(order::router().route_layer(middleware::from_fn_with_state(
            authenticator,
            crate::auth::require_auth,
        )))
}

use axum::Router;
pub mod health;
pub mod token;
pub fn router() -> Router {
    Router::new().merge(health::router()).merge(token::router())
}
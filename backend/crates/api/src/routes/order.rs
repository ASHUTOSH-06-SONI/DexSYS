use axum::{routing::post,Json,Router};
use crate::state::AppState;
use crate::order::Order;
pub fn router()-> Router<AppState>{
    Router::<AppState>::new().route("/orders",post(create_order))
}
async fn create_order(Json(order): Json<Order>,)->Json<Order>{
    Json(order)
}
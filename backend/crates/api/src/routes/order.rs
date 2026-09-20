use axum::{routing::{get,post},Json,Router, extract::{Path,State}};
use crate::state::AppState;
use crate::order::Order;
use crate::error::TokenError;

pub fn router()-> Router<AppState>{
    Router::<AppState>::new().route("/orders",post(create_order))
    .route("/orders/{id}",get(get_order))
}
async fn create_order(State(state): State<AppState>,Json(order): Json<Order>,)->Json<Order>{
    let mut orders = state.orders.write().await;
    orders.insert(order.id.clone(), order.clone());
    Json(order)
}

async fn get_order(State(state): State<AppState>,Path(id): Path<String>,)->Result<Json<Order>,TokenError>{
    let orders = state.orders.read().await;
    match orders.get(&id){
        Some(order)=>Ok(Json(order.clone())),
        None=> Err(TokenError::NotFound),
    }
}
use axum::{routing::{get,post,delete},Json,Router, extract::{Path,State},http::StatusCode};
use crate::state::AppState;
use crate::order::{Order, OrderStatus};
use crate::error::OrderError;

pub fn router()-> Router<AppState>{
    Router::<AppState>::new().route("/orders",post(create_order))
    .route("/orders/{id}",get(get_order))
    .route("/orders",get(get_orders))
    .route("/orders/{id}",delete(cancel_order))
}
async fn create_order(State(state): State<AppState>,Json(order): Json<Order>,)->Result<Json<Order>,OrderError>{
    order.validate()?; 
    let mut order = order;
    order.status = OrderStatus::Pending;
    let mut orders = state.orders.write().await;
    if orders.contains_key(&order.id){
        return Err(OrderError::AlreadyExists);
    }else{
        orders.insert(order.id.clone(), order.clone());
    }
    Ok(Json(order))
}

async fn get_order(State(state): State<AppState>,Path(id): Path<String>,)->Result<Json<Order>,OrderError>{
    let orders = state.orders.read().await;
    match orders.get(&id){
        Some(order)=>Ok(Json(order.clone())),
        None=>Err(OrderError::NotFound),
    }
}
async fn get_orders(State(state):State<AppState>,)->Json<Vec<Order>>{
    let orders = state.orders.read().await;
    let mut result = Vec::new();
    for order in orders.values(){
        result.push(order.clone());
    }
    Json(result)
}
async fn cancel_order(State(state): State<AppState>,Path(id): Path<String>,)->Result<StatusCode, OrderError>{
    let mut orders = state.orders.write().await;
    match orders.get_mut(&id) {
        Some(order) => {
            order.status = OrderStatus::Cancelled;
            Ok(StatusCode::NO_CONTENT)
        }
        None => Err(OrderError::NotFound),
    }
}
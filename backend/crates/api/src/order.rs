use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderSide{
    Buy,
    Sell,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType{
    Limit,
    Market,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order{
    pub id: String,
    pub user_id: String,
    pub trading_pair: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<f64>,
    pub quantity: f64,
}
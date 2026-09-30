#[derive(Debug, Clone)]
pub enum OrderSide{
    Buy,
    Sell,
}
#[derive(Debug,Clone)]
pub enum OrderType{
    Limit,
    Market,
}
#[derive(Debug,Clone)]
pub struct Order{
    pub id: String,
    pub user_id: String,
    pub trading_pair: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<i64>,
    pub quantity: i64,
}
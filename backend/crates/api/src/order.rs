use serde::{Deserialize, Serialize};

use crate::error::OrderError;

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

impl Order{
    pub fn validate(&self) -> Result<(), OrderError> {
        if self.id.is_empty() {
            return Err(OrderError::InvalidOrder);
        }

    if self.user_id.is_empty() {
        return Err(OrderError::InvalidOrder);
    }

    if self.trading_pair.is_empty() {
        return Err(OrderError::InvalidOrder);
    }

    if self.quantity <= 0.0 {
        return Err(OrderError::InvalidOrder);
    }

    match self.order_type {
        OrderType::Limit => {
            match self.price {
                Some(price) if price > 0.0 => {}
                _ => return Err(OrderError::InvalidOrder),
            }
        }

        OrderType::Market => {
            if self.price.is_some() {
                return Err(OrderError::InvalidOrder);
            }
        }
    }
    Ok(())
    }
}
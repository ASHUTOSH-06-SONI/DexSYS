use serde::{Deserialize, Serialize};

use crate::error::OrderError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType {
    Limit,
    Market,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Filled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub user_id: String,
    pub trading_pair: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<f64>,
    pub quantity: f64,
    pub status: OrderStatus,
}

impl Order {
    pub fn validate(&self) -> Result<(), OrderError> {
        if self.id.is_empty()
            || self.user_id.is_empty()
            || self.trading_pair.is_empty()
            || !self.quantity.is_finite()
            || self.quantity <= 0.0
        {
            return Err(OrderError::InvalidOrder);
        }

        match self.order_type {
            OrderType::Limit => match self.price {
                Some(price) if price.is_finite() && price > 0.0 => {}
                _ => return Err(OrderError::InvalidOrder),
            },
            OrderType::Market if self.price.is_some() => {
                return Err(OrderError::InvalidOrder);
            }
            OrderType::Market => {}
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_order() -> Order {
        Order {
            id: "order".into(),
            user_id: "wallet".into(),
            trading_pair: "ETH/BTC".into(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(1.0),
            quantity: 1.0,
            status: OrderStatus::Pending,
        }
    }

    #[test]
    fn validation_rejects_non_finite_financial_values() {
        let mut order = valid_order();
        order.quantity = f64::INFINITY;
        assert!(matches!(order.validate(), Err(OrderError::InvalidOrder)));

        let mut order = valid_order();
        order.price = Some(f64::NAN);
        assert!(matches!(order.validate(), Err(OrderError::InvalidOrder)));
    }
}

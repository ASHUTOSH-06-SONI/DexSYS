use shared::{Order, OrderSide};
#[cfg(test)]
use shared::OrderType;
use std::collections::BTreeMap;
use std::collections::VecDeque;

#[derive(Clone)]
pub struct PriceLevel {
    pub price: i64,
    pub orders: VecDeque<Order>,
}

#[derive(Clone)]
pub struct OrderBook {
    pub bids: BTreeMap<i64, PriceLevel>,
    pub asks: BTreeMap<i64, PriceLevel>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AggregatedLevel {
    pub price: i64,
    pub quantity: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DepthError {
    InvalidPrice,
    InvalidQuantity,
    QuantityOverflow,
}

impl OrderBook {
    pub fn new() -> Self {
        Self {
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
        }
    }

    pub fn add_order(&mut self, order: Order) {
        let price = order.price.unwrap();
        let book = match order.side {
            OrderSide::Buy => &mut self.bids,
            OrderSide::Sell => &mut self.asks,
        };

        book.entry(price).or_insert_with(|| PriceLevel {price,orders: VecDeque::new(),}).orders.push_back(order);
    }

    pub fn best_bid(&self) -> Option<&PriceLevel> {
        self.bids.last_key_value().map(|(_, level)| level)
    }

    pub fn best_ask(&self) -> Option<&PriceLevel> {
        self.asks.first_key_value().map(|(_, level)| level)
    }

    pub fn aggregated_bids(&self) -> Result<Vec<AggregatedLevel>, DepthError> {
        aggregate_levels(self.bids.iter().rev())
    }

    pub fn aggregated_asks(&self) -> Result<Vec<AggregatedLevel>, DepthError> {
        aggregate_levels(self.asks.iter())
    }

    pub fn cancel_order(&mut self, order_id: &str)->bool{
        let location = {
            let mut found = None;
            for (side,book) in [(OrderSide::Buy, &self.bids), (OrderSide::Sell, &self.asks,)]{
                for(price,level) in book{
                    let found_order = level.orders.iter().any(|order| order.id == order_id);
                    if found_order{
                        found = Some((side.clone(),*price));
                        break;
                    }
                }
                if found.is_some(){
                    break;
                }
            }found
        };
        let Some((side,price)) = location else{
            return false;
        };
        let book = match side{
            OrderSide::Buy => &mut self.bids,
            OrderSide::Sell => &mut self.asks,
        };
        let level = book.get_mut(&price).unwrap();
        level.orders.retain(|order| order.id != order_id);
        if level.orders.is_empty() {
            book.remove(&price);
        }
        true
    }
}

fn aggregate_levels<'a>(
    levels: impl Iterator<Item = (&'a i64, &'a PriceLevel)>,
) -> Result<Vec<AggregatedLevel>, DepthError> {
    levels
        .map(|(price, level)| {
            if *price <= 0 {
                return Err(DepthError::InvalidPrice);
            }
            let quantity = level.orders.iter().try_fold(0_i64, |total, order| {
                if order.quantity <= 0 {
                    return Err(DepthError::InvalidQuantity);
                }
                total
                    .checked_add(order.quantity)
                    .ok_or(DepthError::QuantityOverflow)
            })?;
            if quantity == 0 {
                return Err(DepthError::InvalidQuantity);
            }
            Ok(AggregatedLevel {
                price: *price,
                quantity,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::{OrderSide, OrderType};

    #[test]
    fn test_add_and_best_bid() {
        let mut book = OrderBook::new();

        let order = Order {
            id: "1".to_string(),
            user_id: "alice".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 5,
        };

        book.add_order(order);

        assert_eq!(book.best_bid().unwrap().price, 3500);
    }
}

#[test]
fn test_fifo_same_price() {
    let mut book = OrderBook::new();

    let order1 = Order {
        id: "1".to_string(),
        user_id: "alice".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 5,
    };

    let order2 = Order {
        id: "2".to_string(),
        user_id: "bob".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 3,
    };

    book.add_order(order1);
    book.add_order(order2);

    let level = book.bids.get(&3500).unwrap();

    assert_eq!(level.orders.front().unwrap().id, "1");
    assert_eq!(level.orders.back().unwrap().id, "2");
}

#[test]
fn test_best_bid_price_priority() {
    let mut book = OrderBook::new();

    let order1 = Order {
        id: "1".to_string(),
        user_id: "alice".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3490),
        quantity: 5,
    };

    let order2 = Order {
        id: "2".to_string(),
        user_id: "bob".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 3,
    };

    let order3 = Order {
        id: "3".to_string(),
        user_id: "charlie".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3480),
        quantity: 2,
    };

    book.add_order(order1);
    book.add_order(order2);
    book.add_order(order3);

    assert_eq!(book.best_bid().unwrap().price, 3500);
}

#[test]
fn test_fifo_same_ask_price() {
    let mut book = OrderBook::new();

    let order1 = Order {
        id: "1".to_string(),
        user_id: "alice".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Sell,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 5,
    };

    let order2 = Order {
        id: "2".to_string(),
        user_id: "bob".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Sell,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 3,
    };

    book.add_order(order1);
    book.add_order(order2);

    let level = book.asks.get(&3500).unwrap();

    assert_eq!(level.orders.front().unwrap().id, "1");
    assert_eq!(level.orders.back().unwrap().id, "2");
}
#[test]
fn test_empty_orderbook() {
    let book = OrderBook::new();

    assert!(book.best_bid().is_none());
    assert!(book.best_ask().is_none());
}
#[test]
fn test_bid_and_ask_are_separate() {
    let mut book = OrderBook::new();

    let buy = Order {
        id: "1".to_string(),
        user_id: "alice".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 5,
    };

    let sell = Order {
        id: "2".to_string(),
        user_id: "bob".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Sell,
        order_type: OrderType::Limit,
        price: Some(3510),
        quantity: 3,
    };

    book.add_order(buy);
    book.add_order(sell);

    assert_eq!(book.best_bid().unwrap().price, 3500);
    assert_eq!(book.best_ask().unwrap().price, 3510);
}

#[test]
fn aggregated_depth_sorts_levels_and_sums_quantities() {
    let mut book = OrderBook::new();
    for (id, side, price, quantity) in [
        ("bid-1", OrderSide::Buy, 100, 4),
        ("bid-2", OrderSide::Buy, 100, 3),
        ("bid-3", OrderSide::Buy, 105, 2),
        ("ask-1", OrderSide::Sell, 110, 5),
        ("ask-2", OrderSide::Sell, 110, 1),
        ("ask-3", OrderSide::Sell, 115, 6),
    ] {
        book.add_order(Order {
            id: id.to_string(),
            user_id: "user".to_string(),
            trading_pair: "ETH/BTC".to_string(),
            side,
            order_type: OrderType::Limit,
            price: Some(price),
            quantity,
        });
    }

    assert_eq!(
        book.aggregated_bids().unwrap(),
        vec![
            AggregatedLevel {
                price: 105,
                quantity: 2
            },
            AggregatedLevel {
                price: 100,
                quantity: 7
            }
        ]
    );
    assert_eq!(
        book.aggregated_asks().unwrap(),
        vec![
            AggregatedLevel {
                price: 110,
                quantity: 6
            },
            AggregatedLevel {
                price: 115,
                quantity: 6
            }
        ]
    );
}

#[test]
fn aggregated_depth_is_empty_when_book_has_no_orders() {
    let book = OrderBook::new();
    assert!(book.aggregated_bids().unwrap().is_empty());
    assert!(book.aggregated_asks().unwrap().is_empty());
}

#[test]
fn aggregated_depth_rejects_overflow_and_invalid_quantities() {
    let mut book = OrderBook::new();
    for (id, quantity) in [("large", i64::MAX), ("overflow", 1)] {
        book.add_order(Order {
            id: id.to_string(),
            user_id: "user".to_string(),
            trading_pair: "ETH/BTC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(100),
            quantity,
        });
    }
    assert_eq!(book.aggregated_bids(), Err(DepthError::QuantityOverflow));

    let mut invalid_book = OrderBook::new();
    invalid_book.add_order(Order {
        id: "invalid".to_string(),
        user_id: "user".to_string(),
        trading_pair: "ETH/BTC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(100),
        quantity: 0,
    });
    assert_eq!(
        invalid_book.aggregated_bids(),
        Err(DepthError::InvalidQuantity)
    );
}

#[test]
fn test_multiple_price_levels() {
    let mut book = OrderBook::new();

    let order1 = Order {
        id: "1".to_string(),
        user_id: "alice".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3490),
        quantity: 5,
    };

    let order2 = Order {
        id: "2".to_string(),
        user_id: "bob".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3500),
        quantity: 3,
    };

    let order3 = Order {
        id: "3".to_string(),
        user_id: "charlie".to_string(),
        trading_pair: "ETH/USDC".to_string(),
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        price: Some(3480),
        quantity: 2,
    };

    book.add_order(order1);
    book.add_order(order2);
    book.add_order(order3);

    assert_eq!(book.bids.len(), 3);
    assert_eq!(book.bids.get(&3500).unwrap().orders.len(), 1);
    assert_eq!(book.bids.get(&3490).unwrap().orders.len(), 1);
    assert_eq!(book.bids.get(&3480).unwrap().orders.len(), 1);
}

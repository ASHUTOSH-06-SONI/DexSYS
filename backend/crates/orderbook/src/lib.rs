use shared::{Order, OrderSide, OrderType};
use std::collections::VecDeque;
use std::collections::BTreeMap;

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

use shared::Order;
use orderbook::OrderBook;

#[derive(Clone)]
pub struct MatchingEngine {
    pub orderbook: OrderBook,
}

pub struct Trade {
    pub buy_order_id: String,
    pub sell_order_id: String,
    pub price: i64,
    pub quantity: i64,
}

impl MatchingEngine {
    pub fn new() -> Self {
        Self {
            orderbook: OrderBook::new(),
        }
    }

    pub fn process_order(&mut self, mut order: Order) -> Vec<Trade> {
        let mut trades = Vec::new();

        if matches!(&order.side, shared::OrderSide::Buy) {
            while order.quantity > 0 {
                let Some(ask) = self.orderbook.best_ask() else {
                    break;
                };

                let ask_price = ask.price;

                if order.price.unwrap() < ask_price {
                    break;
                }

                let (sell_order_id, sell_quantity) = {
                    let level = self.orderbook.asks.get(&ask_price).unwrap();
                    let sell_order = level.orders.front().unwrap();

                    (sell_order.id.clone(), sell_order.quantity)
                };

                let trade_quantity = order.quantity.min(sell_quantity);

                trades.push(Trade {
                    buy_order_id: order.id.clone(),
                    sell_order_id,
                    price: ask_price,
                    quantity: trade_quantity,
                });

                {
                    let level = self.orderbook.asks.get_mut(&ask_price).unwrap();
                    let sell_order = level.orders.front_mut().unwrap();

                    sell_order.quantity -= trade_quantity;
                    order.quantity -= trade_quantity;

                    if sell_order.quantity == 0 {
                        level.orders.pop_front();
                    }
                }

                if self.orderbook
                    .asks
                    .get(&ask_price)
                    .map_or(false, |level| level.orders.is_empty())
                {
                    self.orderbook.asks.remove(&ask_price);
                }
            }

            if order.quantity > 0 {
                self.orderbook.add_order(order);
            }
        } else if matches!(&order.side, shared::OrderSide::Sell) {
            while order.quantity > 0 {
                let Some(bid) = self.orderbook.best_bid() else {
                    break;
                };

                let bid_price = bid.price;

                if order.price.unwrap() > bid_price {
                    break;
                }

                let (buy_order_id, buy_quantity) = {
                    let level = self.orderbook.bids.get(&bid_price).unwrap();
                    let buy_order = level.orders.front().unwrap();

                    (buy_order.id.clone(), buy_order.quantity)
                };

                let trade_quantity = order.quantity.min(buy_quantity);

                trades.push(Trade {
                    buy_order_id,
                    sell_order_id: order.id.clone(),
                    price: bid_price,
                    quantity: trade_quantity,
                });

                {
                    let level = self.orderbook.bids.get_mut(&bid_price).unwrap();
                    let buy_order = level.orders.front_mut().unwrap();

                    buy_order.quantity -= trade_quantity;
                    order.quantity -= trade_quantity;

                    if buy_order.quantity == 0 {
                        level.orders.pop_front();
                    }
                }

                if self.orderbook
                    .bids
                    .get(&bid_price)
                    .map_or(false, |level| level.orders.is_empty())
                {
                    self.orderbook.bids.remove(&bid_price);
                }
            }

            if order.quantity > 0 {
                self.orderbook.add_order(order);
            }
        }

        trades
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::{OrderSide, OrderType};

    #[test]
    fn test_buy_matches_ask_and_rests_remainder() {
        let mut engine = MatchingEngine::new();

        let sell = Order {
            id: "sell_1".to_string(),
            user_id: "user_1".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 2,
        };

        engine.orderbook.add_order(sell);

        let buy = Order {
            id: "buy_1".to_string(),
            user_id: "user_2".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 5,
        };

        let trades = engine.process_order(buy);

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].buy_order_id, "buy_1");
        assert_eq!(trades[0].sell_order_id, "sell_1");
        assert_eq!(trades[0].price, 3500);
        assert_eq!(trades[0].quantity, 2);

        assert!(engine.orderbook.best_ask().is_none());

        let bid = engine.orderbook.best_bid().unwrap();
        assert_eq!(bid.price, 3500);
        assert_eq!(bid.orders.front().unwrap().quantity, 3);
    }

    #[test]
    fn test_sell_matches_bid_and_rests_remainder() {
        let mut engine = MatchingEngine::new();

        let buy = Order {
            id: "buy_1".to_string(),
            user_id: "user_1".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 2,
        };

        engine.orderbook.add_order(buy);

        let sell = Order {
            id: "sell_1".to_string(),
            user_id: "user_2".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 5,
        };

        let trades = engine.process_order(sell);

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].buy_order_id, "buy_1");
        assert_eq!(trades[0].sell_order_id, "sell_1");
        assert_eq!(trades[0].price, 3500);
        assert_eq!(trades[0].quantity, 2);

        assert!(engine.orderbook.best_bid().is_none());

        let ask = engine.orderbook.best_ask().unwrap();
        assert_eq!(ask.price, 3500);
        assert_eq!(ask.orders.front().unwrap().quantity, 3);
    }

    #[test]
    fn test_buy_does_not_match_higher_ask() {
        let mut engine = MatchingEngine::new();

        let sell = Order {
            id: "sell_1".to_string(),
            user_id: "user_1".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3600),
            quantity: 2,
        };

        engine.orderbook.add_order(sell);

        let buy = Order {
            id: "buy_1".to_string(),
            user_id: "user_2".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 5,
        };

        let trades = engine.process_order(buy);

        assert!(trades.is_empty());

        let bid = engine.orderbook.best_bid().unwrap();
        assert_eq!(bid.price, 3500);
        assert_eq!(bid.orders.front().unwrap().quantity, 5);

        let ask = engine.orderbook.best_ask().unwrap();
        assert_eq!(ask.price, 3600);
        assert_eq!(ask.orders.front().unwrap().quantity, 2);
    }

    #[test]
    fn test_sell_does_not_match_lower_bid() {
        let mut engine = MatchingEngine::new();

        let buy = Order {
            id: "buy_1".to_string(),
            user_id: "user_1".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3400),
            quantity: 2,
        };

        engine.orderbook.add_order(buy);

        let sell = Order {
            id: "sell_1".to_string(),
            user_id: "user_2".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 5,
        };

        let trades = engine.process_order(sell);

        assert!(trades.is_empty());

        let bid = engine.orderbook.best_bid().unwrap();
        assert_eq!(bid.price, 3400);
        assert_eq!(bid.orders.front().unwrap().quantity, 2);

        let ask = engine.orderbook.best_ask().unwrap();
        assert_eq!(ask.price, 3500);
        assert_eq!(ask.orders.front().unwrap().quantity, 5);
    }

    #[test]
    fn test_buy_matches_multiple_asks() {
        let mut engine = MatchingEngine::new();

        engine.orderbook.add_order(Order {
            id: "sell_1".to_string(),
            user_id: "user_1".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3500),
            quantity: 2,
        });

        engine.orderbook.add_order(Order {
            id: "sell_2".to_string(),
            user_id: "user_2".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            price: Some(3510),
            quantity: 3,
        });

        let buy = Order {
            id: "buy_1".to_string(),
            user_id: "user_3".to_string(),
            trading_pair: "ETH/USDC".to_string(),
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            price: Some(3510),
            quantity: 5,
        };

        let trades = engine.process_order(buy);

        assert_eq!(trades.len(), 2);

        assert_eq!(trades[0].sell_order_id, "sell_1");
        assert_eq!(trades[0].price, 3500);
        assert_eq!(trades[0].quantity, 2);

        assert_eq!(trades[1].sell_order_id, "sell_2");
        assert_eq!(trades[1].price, 3510);
        assert_eq!(trades[1].quantity, 3);

        assert!(engine.orderbook.best_ask().is_none());
        assert!(engine.orderbook.best_bid().is_none());
    }
}

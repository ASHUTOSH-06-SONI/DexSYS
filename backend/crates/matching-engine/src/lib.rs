use shared::Order;
use orderbook::OrderBook;

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

        if !matches!(&order.side, shared::OrderSide::Buy) {
            return trades;
        }

        let mut remaining = order.quantity;

        while remaining > 0 {
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

            let trade_quantity = remaining.min(sell_quantity);

            trades.push(Trade {
                buy_order_id: order.id.clone(),
                sell_order_id: sell_order_id,
                price: ask_price,
                quantity: trade_quantity,
            });

            remaining -= trade_quantity;

            let level = self.orderbook.asks.get_mut(&ask_price).unwrap();
            let sell_order = level.orders.front_mut().unwrap();

            sell_order.quantity -= trade_quantity;

            if sell_order.quantity == 0 {
                level.orders.pop_front();
            }

            if level.orders.is_empty() {
                self.orderbook.asks.remove(&ask_price);
            }
        }

        if remaining > 0 {
            order.quantity = remaining;
            self.orderbook.add_order(order);
        }

        trades
    }
}
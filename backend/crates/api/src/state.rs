// How does main.rs give this AppState to Axum, and how does tokens() get it back?
use std::collections::HashMap;
use crate::token::TokenInfo;
#[derive(Clone)]
pub struct AppState {
    pub tokens: HashMap<String, TokenInfo>,
}
impl AppState{
    pub fn new()->Self{
        let mut tokens = HashMap::new();
        let eth = TokenInfo {
        symbol: "ETH".to_string(),
        name: "Ethereum".to_string(),
        validated: true,
        price: 3500.0,
        change_24h: 2.4,
        balance: 1.25,
        contract_address: "0x...".to_string(),
        supported_pairs: vec![
            "USDC".to_string(),
            "WBTC".to_string(),
            ],
        };
        let btc = TokenInfo {
            symbol: "BTC".to_string(),
            name: "Bitcoin".to_string(),
            validated: true,
            price: 75800.0,
            change_24h: 3.4,
            balance: 0.5,
            contract_address: "0x...".to_string(),
            supported_pairs: vec![
                "USDC".to_string(),
                "ETH".to_string(),
            ],
        };

        tokens.insert("ETH".to_string(),eth);
        tokens.insert("BTC".to_string(),btc);

        Self{tokens}
    }
}
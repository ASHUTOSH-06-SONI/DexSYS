use axum::{extract::Path, routing::get, Json, Router};
use crate::token::TokenInfo;

pub fn router()-> Router{
    Router::new().route("/tokens/{symbol}", get(tokens))
}

async fn tokens(Path(symbol):Path<String>)-> Json<TokenInfo>{
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
    Json(eth)
}

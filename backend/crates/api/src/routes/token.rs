use axum::{extract::Path, routing::get, Json, Router};
use crate::token::TokenInfo;
use crate::error::TokenError;
pub fn router()-> Router{
    Router::new().route("/tokens/{symbol}", get(tokens))
}
async fn tokens(Path(symbol): Path<String>) -> Result<Json<TokenInfo>, TokenError> {
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

    let btc: TokenInfo = TokenInfo {
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

    match symbol.as_str() {
        "ETH" => Ok(Json(eth)),
        "BTC" =>Ok(Json(btc)),
        _ => Err(TokenError::NotFound),
    }
}
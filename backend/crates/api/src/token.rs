use serde::Serialize;
#[derive(Debug,Clone,Serialize)]
pub struct TokenInfo{
    pub symbol: String,
    pub name: String,
    pub validated: bool,
    pub price: f64,
    pub change_24h: f64,
    pub balance: f64,
    pub contract_address: String,
    pub supported_pairs: Vec<String>,
}
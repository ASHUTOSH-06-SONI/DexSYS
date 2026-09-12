use axum::{extract::Path, routing::get, Router};

pub fn router()-> Router{
    Router::new().route("/tokens/{symbol}", get(tokens))
}

async fn tokens(Path(symbol):Path<String>){
    println!("{}",symbol);
}

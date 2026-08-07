use axum::{
    routing::get,
    Json,
    Router,
};
use serde::Serialize;

#[derive(Serialize)]
struct HealthResponse{
    service: String,
    version: String,
    status: String,
}
async fn health()->Json<HealthResponse>{
    Json(HealthResponse{
        service: "DexSYS API".into(),
        version: "0.1.0".into(),
        status: "running".into(),
    })
}

#[tokio::main]
async fn main(){
    let app = Router::new().route("/",get(health)).route("/health",get(health));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await.unwrap();
    println!("DexSYS API Running at http://127.0.0.1:8080 lessgooo");
    axum::serve(listener,app).await.unwrap();
}
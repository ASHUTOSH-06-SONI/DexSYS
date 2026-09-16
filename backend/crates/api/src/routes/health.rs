use axum::{routing::get, Json, Router};
use serde::Serialize;
use crate::state::AppState;
#[derive(Serialize)]
pub struct HealthResponse{
    pub service: String,
    pub version: String,
    pub status: String,
}
async fn health()-> Json<HealthResponse>{
    Json(HealthResponse{
        service: "DexSYS API".into(),
        version: "0.1.0".into(),
        status: "running".into(),
    })
}
pub fn router()-> Router<AppState>{
    Router::<AppState>::new().route("/",get(health)).route("/health",get(health))
}
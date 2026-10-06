use axum::{http::StatusCode, response::{IntoResponse,Response},Json,};

#[derive(Debug)]
pub enum TokenError{
    NotFound,
}

impl IntoResponse for TokenError{
    fn into_response(self)->Response{
        match self{
            TokenError::NotFound=>{(StatusCode::NOT_FOUND,Json(serde_json::json!({"error": "Token Not Found"})),).into_response()}
        }
    }
}

pub enum OrderError{
    NotFound,
    InvalidOrder,
    AlreadyExists,
}
impl IntoResponse for OrderError {
    fn into_response(self) -> Response {
        match self {
            OrderError::NotFound => {(StatusCode::NOT_FOUND,Json(serde_json::json!({"error": "Order Not Found"})),).into_response()}
            OrderError::InvalidOrder => {(StatusCode::BAD_REQUEST,Json(serde_json::json!({"error": "Invalid Order"})),).into_response()}
            OrderError::AlreadyExists=>{(StatusCode::CONFLICT,Json(serde_json::json!({"error": "Order Already Exists"})),).into_response()}
        }
    }
}
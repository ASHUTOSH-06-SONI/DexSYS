use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug)]
pub enum TokenError {
    NotFound,
    Internal,
}

impl IntoResponse for TokenError {
    fn into_response(self) -> Response {
        match self {
            TokenError::NotFound => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Token Not Found"})),
            )
                .into_response(),
            TokenError::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Persistence operation failed"})),
            )
                .into_response(),
        }
    }
}

#[derive(Debug)]
pub enum OrderError {
    NotFound,
    InvalidOrder,
    AlreadyExists,
    InvalidTransition,
    Internal,
}

impl IntoResponse for OrderError {
    fn into_response(self) -> Response {
        match self {
            OrderError::NotFound => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Order Not Found"})),
            )
                .into_response(),
            OrderError::InvalidOrder => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid Order"})),
            )
                .into_response(),
            OrderError::AlreadyExists => (
                StatusCode::CONFLICT,
                Json(serde_json::json!({"error": "Order Already Exists"})),
            )
                .into_response(),
            OrderError::InvalidTransition => (
                StatusCode::CONFLICT,
                Json(serde_json::json!({"error": "Invalid Order State Transition"})),
            )
                .into_response(),
            OrderError::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Persistence operation failed"})),
            )
                .into_response(),
        }
    }
}

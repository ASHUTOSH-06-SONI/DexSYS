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

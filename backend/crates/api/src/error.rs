use axum::{http::StatusCode, response::{IntoResponse,Response}};

#[derive(Debug)]
pub enum TokenError{
    NotFound,
}

impl IntoResponse for TokenError{
    fn into_response(self)->Response{
        match self{
            TokenError::NotFound=>StatusCode::NOT_FOUND.into_response(),
        }
    }
}

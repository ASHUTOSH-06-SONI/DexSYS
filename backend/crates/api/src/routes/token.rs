use axum::{
    Json, Router,
    extract::{Path, State},
    routing::get,
};

use crate::{
    error::TokenError,
    repository::{self, RepositoryError},
    state::AppState,
    token::TokenInfo,
};

pub fn router() -> Router<AppState> {
    Router::<AppState>::new().route("/tokens/{symbol}", get(tokens))
}

async fn tokens(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
) -> Result<Json<TokenInfo>, TokenError> {
    match repository::get_token(&state.pool, &symbol).await {
        Ok(token) => Ok(Json(token)),
        Err(RepositoryError::NotFound) => Err(TokenError::NotFound),
        Err(error) => {
            eprintln!("Token persistence request failed: {error:?}");
            Err(TokenError::Internal)
        }
    }
}

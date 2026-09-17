use axum::{extract::{Path,State}, routing::get, Json, Router};
use crate::token::TokenInfo;
use crate::error::TokenError;
use crate::state::AppState;
pub fn router()-> Router<AppState>{

    Router::<AppState>::new().route("/tokens/{symbol}",get(tokens)
)
}
async fn tokens(State(state): State<AppState>,Path(symbol): Path<String>) -> Result<Json<TokenInfo>, TokenError> {
    match state.tokens.get(&symbol){
        Some(token)=>Ok(Json(token.clone())),
        None=> Err(TokenError::NotFound),
    }
}
use std::{collections::HashMap, sync::Arc};

use matching_engine::MatchingEngine;
use sqlx::PgPool;
use tokio::sync::Mutex;

use crate::{
    matching::restore_resting_order,
    repository::{self, RepositoryError},
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub matching_engines: Arc<Mutex<HashMap<String, MatchingEngine>>>,
}

impl AppState {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            matching_engines: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn restore(pool: PgPool) -> Result<Self, RepositoryError> {
        let mut matching_engines = HashMap::new();
        for order in repository::list_resting_orders(&pool).await? {
            let engine = matching_engines
                .entry(order.trading_pair.clone())
                .or_insert_with(MatchingEngine::new);
            restore_resting_order(engine, &order)?;
        }
        Ok(Self {
            pool,
            matching_engines: Arc::new(Mutex::new(matching_engines)),
        })
    }
}

use std::path::PathBuf;

use api::{auth::Authenticator, db, repository, routes, state::AppState};

#[tokio::main]
async fn main() {
    let env_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../.env");
    if env_path.is_file() {
        dotenvy::from_path(&env_path).expect("Failed to load the repository root .env file");
    }

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = db::connect(&database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    sqlx::migrate!("../../migrations")
        .run(&pool)
        .await
        .expect("Failed to apply PostgreSQL migrations");
    repository::seed_demo_data(&pool)
        .await
        .expect("Failed to initialize persistent demo token metadata");

    let state = AppState::restore(pool)
        .await
        .expect("Failed to restore persisted limit orders into the in-memory orderbooks");
    let authenticator = Authenticator::from_env().expect("Invalid Auth0 configuration");
    let cors = routes::cors_layer_from_env().expect("Invalid CORS configuration");
    let app = routes::router(authenticator).layer(cors).with_state(state);
    let port: u16 = std::env::var("PORT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "8080".to_string())
        .parse()
        .expect("PORT must be a valid port number");
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("Failed to bind TCP listener");

    println!("DexSYS API listening on 0.0.0.0:{port}");
    axum::serve(listener, app).await.expect("API server failed");
}

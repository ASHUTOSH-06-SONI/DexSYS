use std::path::PathBuf;

use api::{db, repository, routes, state::AppState};

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

    let app = routes::router().with_state(AppState::new(pool));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("Failed to bind API listener");

    println!("DexSYS API running at http://127.0.0.1:8080");
    axum::serve(listener, app).await.expect("API server failed");
}

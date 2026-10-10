
use api::db;
use api::routes;
use api::state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = db::connect(&database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .expect("PostgreSQL connection test failed");

    println!("DexSYS PostgreSQL connection successful!");

    let state = AppState::new();
    let app = routes::router().with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("Failed to bind API listener");

    println!("DexSYS API running at http://127.0.0.1:8080");
    axum::serve(listener, app)
        .await
        .expect("API server failed");
}

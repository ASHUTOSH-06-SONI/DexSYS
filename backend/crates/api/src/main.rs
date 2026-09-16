use api::routes;
use api::state::AppState;
#[tokio::main]
async fn main() {
    let state = AppState {};
    let app = routes::router().with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .unwrap();
    println!("DexSYS API Running at http://127.0.0.1:8080 lessgooo");
    axum::serve(listener, app).await.unwrap();
}
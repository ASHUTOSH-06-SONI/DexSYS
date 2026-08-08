use api::routes;
#[tokio::main]
async fn main(){
    let app = routes::router();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await.unwrap();
    println!("DexSYS API Running at http://127.0.0.1:8080 lessgooo");
    axum::serve(listener,app).await.unwrap();
}
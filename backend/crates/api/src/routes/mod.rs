use axum::{
    Router,
    http::{HeaderValue, Method, Uri, header},
    middleware,
};
use tower_http::cors::CorsLayer;

use crate::{auth::Authenticator, state::AppState};

pub mod health;
pub mod market;
pub mod order;
pub mod token;

pub fn cors_layer_from_env() -> Result<CorsLayer, String> {
    let origins = std::env::var("CORS_ALLOWED_ORIGINS")
        .map_err(|_| "CORS_ALLOWED_ORIGINS must contain the allowed frontend origins".to_owned())?;
    cors_layer(&origins)
}

pub fn cors_layer(origins: &str) -> Result<CorsLayer, String> {
    let origins = origins
        .split(',')
        .map(str::trim)
        .map(parse_origin)
        .collect::<Result<Vec<_>, _>>()?;
    if origins.is_empty() {
        return Err("CORS_ALLOWED_ORIGINS must contain at least one origin".to_owned());
    }

    Ok(CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]))
}

fn parse_origin(origin: &str) -> Result<HeaderValue, String> {
    if origin.is_empty() || origin == "*" {
        return Err(
            "CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) origins, not wildcards".into(),
        );
    }
    let uri = origin
        .parse::<Uri>()
        .map_err(|_| format!("Invalid CORS origin: {origin}"))?;
    let scheme = uri.scheme_str();
    let authority = uri.authority();
    if !matches!(uri.scheme_str(), Some("http" | "https"))
        || authority.is_none()
        || authority.is_some_and(|authority| authority.as_str().contains('@'))
        || uri.path() != "/"
        || uri.query().is_some()
        || scheme
            .zip(authority)
            .is_none_or(|(scheme, authority)| origin != format!("{scheme}://{authority}"))
    {
        return Err(format!(
            "Invalid CORS origin: {origin}. Use only scheme and host, such as https://app.example.com"
        ));
    }
    origin
        .parse::<HeaderValue>()
        .map_err(|_| format!("Invalid CORS origin header value: {origin}"))
}

pub fn router(authenticator: Authenticator) -> Router<AppState> {
    Router::<AppState>::new()
        .merge(health::router())
        .merge(market::router())
        .merge(token::router())
        .merge(order::router().route_layer(middleware::from_fn_with_state(
            authenticator,
            crate::auth::require_auth,
        )))
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode, header},
    };
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::*;

    const ALLOWED_ORIGIN: &str = "https://dexsys.netlify.app";

    fn test_router() -> Router {
        let authenticator = Authenticator::new(
            "https://tenant.example.com/".to_owned(),
            "https://api.example.com".to_owned(),
            "https://tenant.example.com/.well-known/jwks.json".to_owned(),
        )
        .unwrap();
        let pool = PgPoolOptions::new()
            .connect_lazy("postgres://localhost/dexsys_cors_test")
            .expect("create lazy PostgreSQL pool for CORS route test");
        router(authenticator)
            .layer(cors_layer(ALLOWED_ORIGIN).unwrap())
            .with_state(AppState::new(pool))
    }

    #[test]
    fn cors_requires_explicit_valid_origins() {
        assert!(cors_layer("").is_err());
        assert!(cors_layer("*").is_err());
        assert!(cors_layer("https://dexsys.netlify.app/path").is_err());
        assert!(cors_layer("https://dexsys.netlify.app, http://localhost:5173").is_ok());
    }

    #[tokio::test]
    async fn cors_allows_configured_origin_and_rejects_other_origins() {
        let app = test_router();
        let allowed = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header(header::ORIGIN, ALLOWED_ORIGIN)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(allowed.status(), StatusCode::OK);
        assert_eq!(
            allowed
                .headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            ALLOWED_ORIGIN
        );

        let rejected = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header(header::ORIGIN, "https://untrusted.example")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::OK);
        assert!(
            !rejected
                .headers()
                .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        );
    }

    #[tokio::test]
    async fn cors_handles_authenticated_route_preflight_without_authentication() {
        let response = test_router()
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/orders")
                    .header(header::ORIGIN, ALLOWED_ORIGIN)
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .header(
                        header::ACCESS_CONTROL_REQUEST_HEADERS,
                        "authorization,content-type",
                    )
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            ALLOWED_ORIGIN
        );
        let methods = response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_METHODS)
            .unwrap()
            .to_str()
            .unwrap();
        assert!(methods.contains("POST"));
        assert!(methods.contains("GET"));
        assert!(methods.contains("PATCH"));
        assert!(methods.contains("DELETE"));
        assert!(methods.contains("OPTIONS"));
        let headers = response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_HEADERS)
            .unwrap()
            .to_str()
            .unwrap()
            .to_ascii_lowercase();
        assert!(headers.contains("authorization"));
        assert!(headers.contains("content-type"));
        assert!(
            !response
                .headers()
                .contains_key(header::ACCESS_CONTROL_ALLOW_CREDENTIALS)
        );
    }
}

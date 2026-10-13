use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    Json,
    extract::State,
    http::{Request, StatusCode, header::AUTHORIZATION},
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{
    Algorithm, DecodingKey, Validation, decode, decode_header,
    jwk::{AlgorithmParameters, JwkSet},
};
use serde::Deserialize;
use tokio::sync::Mutex;

const JWKS_CACHE_TTL: Duration = Duration::from_secs(60 * 60);
const UNKNOWN_KID_REFRESH_COOLDOWN: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct Authenticator {
    issuer: Arc<str>,
    audience: Arc<str>,
    jwks: JwksCache,
}

#[derive(Clone)]
struct JwksCache {
    url: Arc<str>,
    client: reqwest::Client,
    cached: Arc<Mutex<Option<CachedJwks>>>,
    refresh_lock: Arc<Mutex<()>>,
    unknown_kid_refresh_at: Arc<Mutex<Option<Instant>>>,
}

struct CachedJwks {
    keys: JwkSet,
    fetched_at: Instant,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Principal {
    pub issuer: String,
    pub subject: String,
}

#[derive(Debug)]
pub enum AuthError {
    Unauthorized,
    JwksUnavailable,
}

#[derive(Deserialize)]
struct Claims {
    iss: String,
    aud: Audience,
    exp: u64,
    sub: String,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Audience {
    One(String),
    Many(Vec<String>),
}

impl Authenticator {
    pub fn new(issuer: String, audience: String, jwks_url: String) -> Result<Self, String> {
        if issuer.is_empty() || audience.is_empty() || jwks_url.is_empty() {
            return Err("Auth0 issuer, audience, and JWKS URL must be non-empty".into());
        }
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|error| format!("Failed to configure JWKS HTTP client: {error}"))?;
        Ok(Self {
            issuer: issuer.into(),
            audience: audience.into(),
            jwks: JwksCache {
                url: jwks_url.into(),
                client,
                cached: Arc::new(Mutex::new(None)),
                refresh_lock: Arc::new(Mutex::new(())),
                unknown_kid_refresh_at: Arc::new(Mutex::new(None)),
            },
        })
    }

    pub fn from_env() -> Result<Self, String> {
        let domain = std::env::var("AUTH0_DOMAIN")
            .map_err(|_| "AUTH0_DOMAIN must be set to the Auth0 tenant domain".to_owned())?;
        let domain = domain.trim();
        if domain.is_empty() || domain.contains('/') || domain.contains("://") {
            return Err("AUTH0_DOMAIN must be a hostname without a scheme or path".into());
        }
        let audience = std::env::var("AUTH0_AUDIENCE")
            .unwrap_or_else(|_| "https://api.dexsys.local".to_owned());
        let issuer = format!("https://{domain}/");
        let jwks_url = format!("https://{domain}/.well-known/jwks.json");
        Self::new(issuer, audience, jwks_url)
    }

    pub async fn validate(&self, token: &str) -> Result<Principal, AuthError> {
        let header = decode_header(token).map_err(|_| AuthError::Unauthorized)?;
        if header.alg != Algorithm::RS256 {
            return Err(AuthError::Unauthorized);
        }
        let kid = header
            .kid
            .as_deref()
            .filter(|kid| !kid.is_empty())
            .ok_or(AuthError::Unauthorized)?;
        let key = self.jwks.key(kid).await?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[self.issuer.as_ref()]);
        validation.set_audience(&[self.audience.as_ref()]);
        validation.required_spec_claims = ["exp", "iss", "aud", "sub"]
            .into_iter()
            .map(str::to_owned)
            .collect();
        validation.leeway = 0;
        let claims = decode::<Claims>(token, &key, &validation)
            .map_err(|_| AuthError::Unauthorized)?
            .claims;
        let audience_matches = match claims.aud {
            Audience::One(value) => value == self.audience.as_ref(),
            Audience::Many(values) => values.iter().any(|value| value == self.audience.as_ref()),
        };
        if claims.iss != self.issuer.as_ref()
            || !audience_matches
            || claims.exp <= unix_time()
            || claims.sub.trim().is_empty()
        {
            return Err(AuthError::Unauthorized);
        }
        Ok(Principal {
            issuer: claims.iss,
            subject: claims.sub,
        })
    }
}

impl JwksCache {
    async fn key(&self, kid: &str) -> Result<DecodingKey, AuthError> {
        let mut unknown_kid = false;
        {
            let cached = self.cached.lock().await;
            if let Some(cache) = cached.as_ref() {
                if cache.fetched_at.elapsed() < JWKS_CACHE_TTL {
                    if let Some(key) = jwk_key(&cache.keys, kid) {
                        return Ok(key);
                    }
                    unknown_kid = true;
                }
            }
        }

        let _refresh = self.refresh_lock.lock().await;
        {
            let cached = self.cached.lock().await;
            if let Some(cache) = cached.as_ref() {
                if cache.fetched_at.elapsed() < JWKS_CACHE_TTL {
                    if let Some(key) = jwk_key(&cache.keys, kid) {
                        return Ok(key);
                    }
                    unknown_kid = true;
                }
            }
        }
        if unknown_kid
            && self
                .unknown_kid_refresh_at
                .lock()
                .await
                .is_some_and(|refreshed_at| refreshed_at.elapsed() < UNKNOWN_KID_REFRESH_COOLDOWN)
        {
            return Err(AuthError::Unauthorized);
        }

        let response = self
            .client
            .get(self.url.as_ref())
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|error| {
                eprintln!("Auth0 JWKS request failed: {error}");
                AuthError::JwksUnavailable
            })?;
        let keys = response.json::<JwkSet>().await.map_err(|error| {
            eprintln!("Auth0 JWKS response could not be parsed: {error}");
            AuthError::JwksUnavailable
        })?;
        if unknown_kid {
            *self.unknown_kid_refresh_at.lock().await = Some(Instant::now());
        }
        let key = jwk_key(&keys, kid).ok_or(AuthError::Unauthorized)?;
        *self.cached.lock().await = Some(CachedJwks {
            keys,
            fetched_at: Instant::now(),
        });
        Ok(key)
    }
}

fn jwk_key(keys: &JwkSet, kid: &str) -> Option<DecodingKey> {
    let jwk = keys
        .keys
        .iter()
        .find(|key| key.common.key_id.as_deref() == Some(kid))?;
    if !matches!(&jwk.algorithm, AlgorithmParameters::RSA(_)) {
        return None;
    }
    DecodingKey::from_jwk(jwk).ok()
}

fn unix_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

pub async fn require_auth(
    State(authenticator): State<Authenticator>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let token = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            let (scheme, token) = value.split_once(' ')?;
            (scheme.eq_ignore_ascii_case("Bearer")
                && !token.is_empty()
                && !token.chars().any(char::is_whitespace))
            .then_some(token)
        })
        .ok_or(AuthError::Unauthorized)?;
    let principal = authenticator.validate(token).await?;
    request.extensions_mut().insert(principal);
    Ok(next.run(request).await)
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        match self {
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Unauthorized"})),
            )
                .into_response(),
            Self::JwksUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Authentication service unavailable"})),
            )
                .into_response(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, routing::get};
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    use jsonwebtoken::{EncodingKey, Header, encode};
    use rand::thread_rng;
    use rsa::{
        RsaPrivateKey,
        pkcs1v15::SigningKey,
        signature::{SignatureEncoding, Signer},
        traits::PublicKeyParts,
    };
    use serde::Serialize;
    use serde_json::json;
    use sha2::Sha256;
    use std::net::SocketAddr;
    use tower::ServiceExt;

    const TEST_ISSUER: &str = "https://dexsys-test.auth0.local/";
    const TEST_AUDIENCE: &str = "https://api.dexsys.local";
    const TEST_KID: &str = "dexsys-test-key";

    #[derive(Serialize)]
    struct TestClaims<'a> {
        iss: &'a str,
        aud: &'a str,
        exp: u64,
        sub: &'a str,
    }

    async fn test_authenticator() -> (Authenticator, SigningKey<Sha256>, SocketAddr) {
        let private_key =
            RsaPrivateKey::new(&mut thread_rng(), 2048).expect("generate ephemeral test RSA key");
        let public_key = private_key.to_public_key();
        let jwks = Json(json!({
            "keys": [{
                "kty": "RSA",
                "kid": TEST_KID,
                "alg": "RS256",
                "use": "sig",
                "n": URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be()),
                "e": URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be())
            }]
        }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind local test JWKS listener");
        let address = listener.local_addr().unwrap();
        let app = axum::Router::new().route(
            "/jwks",
            get(move || {
                let jwks = jwks.clone();
                async move { jwks }
            }),
        );
        tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("serve local test JWKS");
        });
        let authenticator = Authenticator::new(
            TEST_ISSUER.to_owned(),
            TEST_AUDIENCE.to_owned(),
            format!("http://{address}/jwks"),
        )
        .unwrap();
        let signing_key = SigningKey::<Sha256>::new(private_key);
        (authenticator, signing_key, address)
    }

    fn signed_token(signing_key: &SigningKey<Sha256>, audience: &str, expiry: u64) -> String {
        let header = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&json!({"alg": "RS256", "typ": "JWT", "kid": TEST_KID})).unwrap(),
        );
        let claims = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&TestClaims {
                iss: TEST_ISSUER,
                aud: audience,
                exp: expiry,
                sub: "auth0|test-subject",
            })
            .unwrap(),
        );
        let signing_input = format!("{header}.{claims}");
        let signature = signing_key.sign(signing_input.as_bytes());
        format!(
            "{signing_input}.{}",
            URL_SAFE_NO_PAD.encode(signature.to_bytes())
        )
    }

    async fn status_for(app: &axum::Router, token: Option<&str>) -> StatusCode {
        let mut request = Request::builder().uri("/");
        if let Some(token) = token {
            request = request.header(AUTHORIZATION, format!("Bearer {token}"));
        }
        app.clone()
            .oneshot(request.body(Body::empty()).unwrap())
            .await
            .unwrap()
            .status()
    }

    #[test]
    fn parses_auth0_audience_as_string_or_list() {
        let single: Claims = serde_json::from_value(serde_json::json!({
            "iss": "issuer",
            "aud": "audience",
            "exp": 1,
            "sub": "subject"
        }))
        .unwrap();
        assert!(matches!(single.aud, Audience::One(value) if value == "audience"));

        let multiple: Claims = serde_json::from_value(serde_json::json!({
            "iss": "issuer",
            "aud": ["other", "audience"],
            "exp": 1,
            "sub": "subject"
        }))
        .unwrap();
        assert!(matches!(multiple.aud, Audience::Many(values) if values.len() == 2));
    }

    #[tokio::test]
    async fn middleware_rejects_missing_invalid_expired_and_wrong_audience_tokens() {
        let (authenticator, signing_key, _) = test_authenticator().await;
        let app = axum::Router::new()
            .route("/", get(|| async { StatusCode::OK }))
            .route_layer(axum::middleware::from_fn_with_state(
                authenticator,
                require_auth,
            ));
        let now = unix_time();

        assert_eq!(status_for(&app, None).await, StatusCode::UNAUTHORIZED);
        assert_eq!(
            status_for(&app, Some("not-a-jwt")).await,
            StatusCode::UNAUTHORIZED
        );
        let hmac_token = encode(
            &Header::new(Algorithm::HS256),
            &TestClaims {
                iss: TEST_ISSUER,
                aud: TEST_AUDIENCE,
                exp: now + 60,
                sub: "auth0|test-subject",
            },
            &EncodingKey::from_secret(b"test-only-secret"),
        )
        .unwrap();
        assert_eq!(
            status_for(&app, Some(&hmac_token)).await,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            status_for(
                &app,
                Some(&signed_token(&signing_key, TEST_AUDIENCE, now - 1))
            )
            .await,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            status_for(
                &app,
                Some(&signed_token(
                    &signing_key,
                    "https://other-api.local",
                    now + 60
                ))
            )
            .await,
            StatusCode::UNAUTHORIZED
        );
    }

    #[tokio::test]
    async fn middleware_accepts_a_valid_api_access_token_and_sets_principal() {
        let (authenticator, signing_key, _) = test_authenticator().await;
        let app =
            axum::Router::new()
                .route(
                    "/",
                    get(
                        |axum::extract::Extension(principal): axum::extract::Extension<
                            Principal,
                        >| async move {
                            Json(json!({"issuer": principal.issuer, "subject": principal.subject}))
                        },
                    ),
                )
                .route_layer(axum::middleware::from_fn_with_state(
                    authenticator,
                    require_auth,
                ));
        let token = signed_token(&signing_key, TEST_AUDIENCE, unix_time() + 60);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header(AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            json!({"issuer": TEST_ISSUER, "subject": "auth0|test-subject"})
        );
    }
}

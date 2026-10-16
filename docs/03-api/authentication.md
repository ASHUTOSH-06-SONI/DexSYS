# API authentication

## Protected routes

`GET /`, `GET /health`, `GET /tokens/{symbol}`, and `GET /market/depth/{base}/{quote}` are public. All four `/orders` operations are protected by `Authorization: Bearer <Auth0 API access token>`.

The backend validates RS256 tokens against the Auth0 tenant JWKS, configured issuer, audience, expiry, and a non-empty subject. `AUTH0_DOMAIN` must be the tenant hostname without scheme or path. `AUTH0_AUDIENCE` defaults to `https://api.dexsys.local`. Auth0 tenant/JWKS errors return `503`; missing, malformed, expired, invalid-signature, wrong-issuer, or wrong-audience tokens return `401`.

The backend maps `(issuer, subject)` to `auth_principals.id`. Created records store that principal ID as the API's string `user_id` and an internal nullable `owner_principal_id`. Caller-supplied ownership is not accepted in the create request. Legacy orders with no owner mapping remain unavailable through user-scoped APIs; they are not assigned automatically.

Auth0 login is separate from wallet ownership. There is no wallet signature, SIWE challenge, custody, or chain identity verification.

## Local configuration

Configure `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` in the frontend environment. The SPA uses the current origin as redirect URI. Register the local origin (normally `http://localhost:5173`) in the Auth0 application's callback/logout/web-origin settings, and configure an API whose audience matches the frontend and backend. Do not place an Auth0 client secret in the SPA.

See [environment configuration](../05-deployment/environment.md) and [getting started](../getting-started.md).
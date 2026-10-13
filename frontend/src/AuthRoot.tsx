import { Auth0Provider } from '@auth0/auth0-react'
import App from './App.tsx'

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE

function AuthRoot() {
  if (!auth0Domain || !auth0ClientId || !auth0Audience) {
    return (
      <main className="auth-setup">
        <h1>Auth0 configuration required</h1>
        <p>Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE to sign in to DexSYS.</p>
      </main>
    )
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      useRefreshTokens
      cacheLocation="localstorage"
      authorizationParams={{
        audience: auth0Audience,
        redirect_uri: window.location.origin,
      }}
    >
      <App />
    </Auth0Provider>
  )
}

export default AuthRoot

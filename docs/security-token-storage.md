# Session credential storage

## Decision

The app deliberately uses different session transports for browser and native clients:

- Browser and installed PWA: an HttpOnly `auth_token` cookie, issued for seven days.
- Capacitor Android: a bearer token stored by Capacitor Secure Storage.

The browser never exposes its bearer secret to JavaScript. Its `auth_session` local-storage
entry is only a non-secret UI bootstrap marker; the HttpOnly cookie remains the credential.

## Same-origin browser API

Production browser requests use the relative `/api` route. `vercel.json` rewrites that route to
the Cloud Run API, so the browser receives and sends the session cookie on the PWA's own origin.
This prevents installed mobile PWAs from depending on a cross-site Cloud Run cookie, which mobile
browsers may restrict or stop sending after the standalone app process is closed.

Native Capacitor builds preserve the existing behavior: they call `VITE_API_URL` directly and
send the secure-storage bearer token. Development also continues to use `VITE_API_URL`, or the
local API fallback when it is not configured.

## Security controls

- The browser auth cookie is `HttpOnly` and `Secure`.
- A companion CSRF cookie and `X-CSRF-Token` header protect browser mutations.
- Native bearer tokens are kept out of local storage.
- The Content Security Policy restricts scripts and outbound connections.
- Server sessions expire after seven days and can be locked or revoked independently.

The Vercel rewrite target must stay aligned with the deployed Cloud Run service URL.

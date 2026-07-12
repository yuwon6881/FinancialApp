# Auth token storage — accepted risk & compensating controls

## Decision

The session Bearer token is stored in `localStorage` (`auth_token`, see `src/lib/api/client.ts`)
and sent as an `Authorization: Bearer` header. We are **keeping** this scheme rather than moving
to an httpOnly cookie.

## Why not httpOnly cookies

The textbook mitigation for "token readable by JavaScript" is an httpOnly, Secure, SameSite
cookie. It was evaluated and rejected for this app's architecture:

- The frontend (Vercel, `https://financialapp-ecru.vercel.app`) and the API (Cloud Run) are on
  **different origins**. Cookie-based auth would require `SameSite=None; Secure` + CORS
  `AllowCredentials` with an explicit origin allow-list.
- The app also ships as a **Capacitor Android app**. A native WebView served from
  `capacitor://localhost` / `https://localhost` calling a cross-origin API does not reliably
  send third-party cookies, so a cookie switch has a high chance of breaking mobile auth.
- It would also require reworking the WebAuthn assertion flow and logout.

The risk/effort/likelihood-of-breaking-production did not justify the change.

## The actual threat and the compensating control

`localStorage` is only exploitable via an XSS that runs in our origin. The frontend has **no
HTML-injection sinks** (no `dangerouslySetInnerHTML` / `innerHTML`), so an XSS would require a
separate vulnerability (e.g. a compromised dependency) first.

To blunt that path we ship a **Content-Security-Policy** (build-time `<meta>`, injected by
`cspMetaPlugin` in `vite.config.ts`):

- `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`) — an injected inline script
  cannot execute.
- `connect-src 'self' <VITE_API_URL origin>` — even if script does run, it cannot exfiltrate the
  token to an attacker-controlled host. `connect-src` is derived from the same `VITE_API_URL`
  the app uses, so the policy can never be stricter than the real API and break requests.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — close common injection/exfil side
  channels.

`style-src`/`font-src` allow `'unsafe-inline'` + the Google Fonts hosts (the app loads Inter from
`fonts.googleapis.com` / `fonts.gstatic.com` and relies on inline styles from Radix/Tailwind and
the splash screen), so those directives are not a script-execution vector.

## Residual gaps (not covered by a meta CSP)

- `frame-ancestors` and `X-Frame-Options` are **not** enforceable via a `<meta>` tag. If
  clickjacking protection is wanted for the web deployment, add them as HTTP response headers
  (e.g. a `vercel.json` `headers` block) — this does not affect the Capacitor app.
- CSP is defense-in-depth, not a substitute for keeping dependencies patched.

## Revisit if

The app moves to a same-origin API (e.g. a Vercel rewrite proxying `/api` → Cloud Run) or drops
the Capacitor target — at that point an httpOnly cookie becomes low-risk and should be adopted.

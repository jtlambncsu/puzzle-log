# 0009. Cognito managed login, OIDC code flow + PKCE, JWT checked at the gateway

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The app stores personal photos and must not be open to anyone with the URL. Only the owner
(and maybe a few friends later) should have accounts.

## Decision

- **Amazon Cognito** user pool with **self sign-up disabled**: users are created by an admin.
- **Managed login** (AWS-hosted sign-in page). The web app uses the **OpenID Connect
  authorization code flow with PKCE** via `oidc-client-ts` / `react-oidc-context`. Public
  client, no secret. Access tokens last 1 hour and refresh automatically for 30 days.
- **API Gateway's JWT authorizer** verifies the access token on every route except
  `GET /api/health` and CORS preflights. The Lambda reads the verified `sub` claim and
  rejects requests without one (defense in depth). Every data access is scoped to that user.

## Alternatives considered

- **A custom login form** (Amplify Auth) — more React practice, but passwords pass through
  our UI, and more to get wrong.
- **Auth0 / Clerk** — nicer developer experience, but another vendor; Cognito keeps everything
  in AWS and is free at this scale.
- **Rolling our own** (sessions, password hashing) — never for a real app.
- **Implicit flow** — deprecated; tokens in URLs. Code + PKCE is the current standard for
  browser and mobile apps.

## Consequences

- No passwords or secrets in our code. The same flow works for the future mobile app.
- Cognito's redirect allow-list needs exact URLs, so Vercel preview URLs can't log in.
- Tokens are stored in `localStorage` so sessions survive restarts; the tradeoff is exposure
  to XSS. Mitigated by React's escaping and no third-party scripts.

## Explaining it in an interview

"The browser uses the OIDC authorization code flow with PKCE against Cognito's hosted login.
API Gateway validates the JWT before Lambda even runs, the function re-checks the user, and
every query is keyed by that user ID, so authorization is enforced at three layers."

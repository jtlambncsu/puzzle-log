# 0026. Cost ceilings and security guardrails

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The owner pays for this out of pocket and asked for two things: no chance of an accidental
huge bill, and security kept in mind. The app has grown to include AI calls (billed per
token) and a few hundred photos. This reviews every service for what it could cost in the
worst case, and the setup for gaps.

## Decision

**Cost: every service has a ceiling, not just an alert.**

- **Requests:** API Gateway throttles the whole API to 10 requests a second (burst 20),
  whoever sends them. That bounds API Gateway, Lambda, DynamoDB and log costs to about $35 a
  month, and only under a month-long attack. The table is in DEPLOYMENT.md.
- **AI calls:** Anthropic credit is prepaid with auto-reload off. Only the signed-in owner
  can trigger a call, only for puzzles waiting for review. `max_tokens` is now 4,000 (was
  16,000), so one call can't cost more than about 4 cents.
- **Storage:** only the owner can upload, 10 MB at most per photo.
- **Alerts:** an AWS Budget ($5 a month) emails on actual and forecasted spend.

**Security:**

- **CORS:** now defaults to the web app's own URL for the API, the photo bucket and the
  Lambda. It used to default to `*`, because the setting was never filled in.
  - With bearer tokens (not cookies), `*` didn't let another site act as the user. Another
    site still can't read the token.
  - The tighter setting removes a class of mistakes if that ever changes.
  - Vercel previews lose nothing: they can't sign in, because Cognito only redirects to
    `webUrls`.
- **Supply chain:**
  - CI runs `npm audit --omit=dev --audit-level=high`, so a known high or critical
    vulnerability in shipped dependencies fails the build.
  - Dependabot opens grouped, monthly PRs for npm (minor and patch) and GitHub Actions.
  - GitHub Actions are bumped to their Node 24 majors now (checkout v7, setup-node v7,
    configure-aws-credentials v6). Node 20 is deprecated on GitHub's runners.
- **Accounts:** DEPLOYMENT.md has a checklist for the owner:
  - MFA on the AWS root user, and no root access keys
  - two-factor on GitHub, Anthropic and Vercel
  - Dependabot security updates and secret scanning in the repo settings
- **Already in place:**
  - no stored AWS keys (OIDC, `main` only)
  - sign-up off, 12-character passwords, no user-existence leaks
  - every data access scoped to the signed-in user
  - photo keys checked for ownership
  - private bucket with signed URLs
  - the Anthropic key in SSM, readable only by the Lambda

## Alternatives considered

- **AWS WAF rate limiting:** finer control per IP, but at least $5 a month plus per-request
  fees. That's more than the attack it would stop could cost, given the stage throttle.
- **Lambda reserved concurrency:** another cap, but new accounts often have only 10
  concurrent executions in total, and reserving them can fail or starve the function. The
  stage throttle already bounds invocations.
- **A Budget action that stops resources automatically:** possible, but heavy to set up
  (IAM role, SCP or instance actions) for a ceiling of about $35. An email plus deleting the
  stack is enough.
- **Server-side daily cap on AI suggestions:** the prepaid credit is already a hard cap,
  and only the owner can make calls.
- **MFA on the app's Cognito login:** the data is low-sensitivity, and turning on required
  MFA after a user pool is created isn't supported (it would mean a new pool and new users).
  The accounts that can cost money (AWS, GitHub, Anthropic) are where MFA matters.

## Consequences

- The worst case is known and small, and every paid service has a hard stop.
- A newly published vulnerability can turn CI red without any code change. That's the
  intent: fix it (or wait for Dependabot's PR) before deploying.
- Adding a new web origin (a custom domain) means updating `WEB_URLS`, which feeds both the
  login redirects and CORS.

## Explaining it in an interview

"I listed every paid resource and gave each one a ceiling, not just an alert: a stage-level
throttle bounds the whole request path, AI spend is prepaid with a per-call token cap, and
only the authenticated owner can write. Then I tightened defaults that were permissive by
accident, like CORS, and added supply-chain checks: `npm audit` in CI and Dependabot."

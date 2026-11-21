# 0006. Web on Vercel, API on AWS

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The goals are AWS experience, and photos that need S3 anyway, plus a quick, pleasant frontend
workflow.

## Decision

- **Web:** Vercel, via its GitHub integration. Every PR gets a preview URL; `main` deploys to
  https://puzzle-log-one.vercel.app.
- **API and data:** AWS (see [0003](0003-express-on-lambda.md), [0004](0004-aws-cdk.md)).

The web app calls the API cross-origin, using `VITE_API_URL`.

## Alternatives considered

- **All on Vercel** (serverless functions, Vercel Blob/Postgres) — simplest, but little AWS
  learning, and the Express API would need reshaping.
- **All on AWS** (S3 + CloudFront for the web) — one platform, but no preview deployments
  without extra work. Still possible later with a small CDK addition.

## Consequences

- Requests are cross-origin, so CORS must be right, including preflights
  ([lessons learned](../lessons-learned.md#cors-preflights-blocked-by-the-authorizer)).
- Two dashboards and two places for configuration.
- Preview URLs change per PR, so Cognito can't redirect to them: login only works on the
  production URL and localhost.

## Explaining it in an interview

"I used each platform for what it's best at: Vercel for frontend previews per PR, AWS for the
API, data and storage. The cost is cross-origin requests, so CORS and auth redirects have to be
configured deliberately."

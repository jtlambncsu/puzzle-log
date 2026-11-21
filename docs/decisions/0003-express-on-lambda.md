# 0003. One Express app running on AWS Lambda

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The API is small (a handful of routes) with spiky, low traffic: a personal app that's idle
most of the day. It should be easy to run locally and cheap in production.

## Decision

Write a normal **Express 5** app and run it on **Lambda** behind an **API Gateway HTTP API**,
adapted with `serverless-http` (`apps/api/src/lambda.ts`). Locally the same app runs as a
regular server (`apps/api/src/index.ts`). Dependencies (store, photo storage, how to identify
the user) are injected into `createApp`, so each entry point chooses its own.

## Alternatives considered

- **One Lambda per route** — finer-grained scaling and permissions, but more infrastructure
  and slower local development for no benefit at this size.
- **Containers (App Runner, ECS Fargate)** — no cold starts, but you pay for idle time, and
  scale-to-zero options are limited.
- **Hono** — a modern, lighter framework built for serverless and edge. A strong choice; Express
  is still the most widely known in interviews and existing codebases.

## Consequences

- Scales to zero: effectively free at personal traffic.
- Cold starts add a few hundred ms to the first request after idle. The bundle is minified
  and runs on ARM64 to keep that low.
- Requests run in a stateless function: no in-memory sessions or caches between requests.

## Explaining it in an interview

"For a low-traffic API, Lambda is pay-per-request and scales to zero. I kept a single Express
app so local development is just `npm run dev`, injected its dependencies so the same code
uses in-memory storage locally and DynamoDB in AWS, and accepted cold starts as the tradeoff."

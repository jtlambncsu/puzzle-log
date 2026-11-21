# 0014. Testing: Vitest, Testing Library, MSW, CDK assertions

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Tests should catch real bugs and survive refactors, run fast in CI, and need no cloud
resources.

## Decision

- **Vitest** everywhere: same config as Vite, fast, Jest-compatible API.
- **API:** Supertest against the Express app with in-memory fakes; `aws-sdk-client-mock` for
  the DynamoDB store; Lambda handler tests with API Gateway event payloads.
- **Web:** **React Testing Library** tests that render the _whole app_ at a URL
  (`renderApp('/puzzles/new')`) and interact as a user would (labels, roles, text), with
  **MSW** intercepting `fetch` and serving an in-memory fake API. Unhandled requests fail the
  test.
- **Infra:** CDK assertion tests on the synthesized templates for security-critical settings.
- CI runs format check, lint, typecheck, tests and builds on every PR.

## Alternatives considered

- **Mocking `fetch` or the API client** — faster to write, but skips the real client, cache
  and router integration, where many bugs live.
- **Playwright end-to-end tests against deployed AWS** — the highest confidence, but slow and
  needs credentials. A good later addition for login and photo-upload smoke tests.

## Consequences

- Tests describe behavior ("saves the puzzle and returns to the list"), so refactoring
  internals doesn't break them.
- jsdom lacks some browser APIs, so `setupTests.ts` polyfills what Radix needs.
- Real login and S3 aren't covered by automated tests; they're verified manually after
  deploys.

## Explaining it in an interview

"Most of my frontend tests render the full app at a route and use MSW to fake the network, so
the API client, cache, router and components all run for real. Tests query by role and
label, like a user or screen reader would, which keeps them stable through refactors."

# 0002. TypeScript everywhere, with a shared source-only package

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The API and its clients must agree on what a puzzle looks like and what's valid. Drift
shows up as runtime bugs (a field renamed on one side only).

## Decision

- **TypeScript in strict mode** in every workspace, with `noUncheckedIndexedAccess`.
- `packages/shared` holds the **Zod schemas** (`createPuzzleSchema`) and types inferred from
  them (`z.infer`). The API validates requests with them, and the web form reuses their rules.
- The shared package is consumed as **TypeScript source** (`"exports": "./src/index.ts"`),
  with no build step: Vite compiles it for the web, and esbuild bundles it into the Lambda.

## Alternatives considered

- **Hand-written interfaces on both sides** — types only exist at compile time, so they can't
  validate untrusted input at runtime. Zod gives both from one definition.
- **OpenAPI + code generation** — great for public APIs or many languages, but heavyweight
  for one TypeScript team.
- **tRPC** — end-to-end types with no schema layer, but couples clients to TypeScript and
  makes the API less conventional for a future mobile app or other consumers.
- **Building the shared package to JS** — needs watch mode in development and build ordering
  in CI; unnecessary when every consumer has a bundler.

## Consequences

- Change a schema and both the API and the web app fail to typecheck until they agree.
- Every consumer of `shared` must compile TypeScript (true for Vite, esbuild and Expo).
- TypeScript is pinned to 6.0 because typescript-eslint doesn't support TypeScript 7 yet.

## Explaining it in an interview

"Types disappear at runtime, so I define the data contract once as Zod schemas in a shared
package. The server uses them to validate requests, the client reuses the same rules in its
forms, and TypeScript types are inferred from them, so the two sides can't drift."

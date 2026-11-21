# 0011. TanStack Router

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The app has several pages (list, detail, add) and needs URLs that work with the back button,
sharing, and refreshes, plus data loading per page.

## Decision

**TanStack Router** with **file-based routes** in `src/routes/`. The Vite plugin generates
`routeTree.gen.ts` (committed, ignored by lint and Prettier) and code-splits each route.

- Routes are fully **type-checked**: `<Link to="/puzzles/$puzzleId" params={...}>` fails to
  compile if the route or param is wrong.
- Shared dependencies (`queryClient`, `api`, `auth`) are injected through **router context**,
  which tests replace with fakes.
- Route **loaders** prefetch data into TanStack Query before rendering; `pendingComponent`
  shows skeletons and `errorComponent` / `notFoundComponent` handle failures.

## Alternatives considered

- **React Router** — the long-time standard and the most common in existing codebases; less
  type-safe.
- **Next.js / TanStack Start** — full-stack frameworks with server rendering; unnecessary for
  an authenticated single-page app with a separate API.

## Consequences

- Wrong links and params are compile errors.
- Route files export a `Route` object, so the Fast Refresh lint rule is configured for that.
- Tests can live next to routes (`*.test.tsx` is ignored by the route generator).

## Explaining it in an interview

"TanStack Router gives type-safe routes and params, and route loaders prefetch with TanStack
Query, so a page's data starts loading before its component renders, avoiding fetch
waterfalls. Dependencies come through router context, which makes testing easy."

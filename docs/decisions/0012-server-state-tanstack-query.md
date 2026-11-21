# 0012. TanStack Query for server state

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Almost all of the app's state is _server_ state: puzzles that live in the API. Hand-written
`useEffect` fetching needs loading/error handling, race-condition guards, caching,
deduplication and refetching, all of which are easy to get subtly wrong.

## Decision

**TanStack Query** owns server state (`src/api/queries.ts`):

- `queryOptions` factories (`puzzlesQueryOptions`, `puzzleQueryOptions`) shared by route
  loaders (`ensureQueryData`) and components (`useSuspenseQuery`).
- A key hierarchy rooted at `['puzzles']`, so one invalidation refreshes lists and details.
- Mutations (`useCreatePuzzle`, `useDeletePuzzle`) invalidate affected queries on success.
- `staleTime` 30 s; no retries for 4xx errors.
- No global state library: local UI state stays in components.

## Alternatives considered

- **`useEffect` + `useState`** — what the first version did; fine for one request, painful
  beyond that.
- **Redux Toolkit / RTK Query** — capable, but more ceremony; most apps' "global state" is
  really server state.
- **SWR** — similar idea, smaller API; TanStack Query has richer mutation and invalidation
  tooling and pairs with TanStack Router.

## Consequences

- Navigating back to a page is instant from cache, then quietly refreshes.
- Mutations use invalidate-and-refetch rather than optimistic updates. Simple and always
  correct; optimistic updates are an easy later upgrade.
- React Query Devtools are included in development builds only.

## Explaining it in an interview

"I separate server state from client state. TanStack Query caches server data by key,
dedupes requests, and handles refetching and invalidation after mutations, which removes most
of the bugs you get from hand-rolled `useEffect` fetching."

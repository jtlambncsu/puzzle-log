# 0001. Monorepo with npm workspaces

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The project has a web app, an API, infrastructure code, and shared types, and will gain a
mobile app. They change together: a new puzzle field touches the schema, the API, the form
and sometimes the infrastructure.

## Decision

One repository with **npm workspaces**: `apps/api`, `apps/web`, `packages/shared`, `infra`
(and later `apps/mobile`). Root scripts run lint, typecheck, test and build across all of them.

## Alternatives considered

- **Separate repos** — every cross-cutting change becomes several PRs, and sharing types
  means publishing a package.
- **pnpm workspaces** — faster and stricter about undeclared dependencies; a fine choice,
  but npm ships with Node, so there's one less tool to learn.
- **Turborepo / Nx** — add task caching and dependency-aware builds. Worth it with many
  packages or slow builds; ours build in seconds. Easy to add later.

## Consequences

- One PR can change the schema, API and UI atomically, and CI checks them together.
- One lockfile and one `node_modules` at the root. Add a dependency to one workspace with
  `npm i <pkg> -w @puzzle-log/web`.
- Every CI run builds and tests everything. Fine at this size.

## Explaining it in an interview

"The frontend, backend and infrastructure share types and change together, so a monorepo
lets one PR update all of them atomically. I used plain npm workspaces because the builds
are fast; I'd reach for Turborepo once build times or package counts grow."

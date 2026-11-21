# Working on Puzzle Log

Context for AI assistants (and humans) picking up this repo. Read `docs/ARCHITECTURE.md` first.

## Owner's goals

- Learning modern React and full-stack patterns for interviews: prefer **popular, current
  libraries** and idiomatic patterns over custom code.
- The owner often works from a phone: keep explanations clear and plain, and give
  copy-pasteable commands for anything they need to run (AWS CloudShell works well).
- **Document decisions.** For any significant choice (a new library, a pattern, an
  infrastructure change), add an ADR in `docs/decisions/` (copy `0000-template.md`, take the
  next number, add it to the index). Include the alternatives and an "explaining it in an
  interview" section. Add real debugging stories to `docs/lessons-learned.md`.

## Stack (see ADRs for why)

- Web: React 19, Vite, Tailwind v4, shadcn/ui (Radix), TanStack Router (file-based routes in
  `apps/web/src/routes`), TanStack Query (`apps/web/src/api/queries.ts`), React Hook Form + Zod.
- API: Express 5 on Lambda; DynamoDB and S3 behind interfaces with in-memory fakes.
- Shared: Zod schemas in `packages/shared` (consumed as TypeScript source).
- Infra: AWS CDK in `infra/`, deployed by GitHub Actions on pushes to `main` using OIDC.

## Conventions

- Before pushing: `npm run format && npm run lint && npm run typecheck && npm test && npm run build`.
- Add shadcn components from `apps/web` with `npx shadcn@latest add <name>`; don't hand-write
  them. Files in `src/components/ui` are generated code.
- Web tests render the app with `renderApp(path)` and fake the API with MSW
  (`src/test/server.ts`). Prefer queries by role/label.
- Every data access in the API is scoped to the signed-in user (`res.locals.userId`).
- TypeScript is pinned to 6.0 until typescript-eslint supports 7.
- Stateful AWS resources are `RETAIN`ed; changing a DynamoDB key schema creates a new table.
- After infra changes deploy, verify against the live API (e.g. `curl` health, 401 without a
  token, CORS preflight 2xx).
- New HTTP methods or request headers in the web client must also be added to API Gateway's
  `corsPreflight` (and the S3 bucket's CORS if the browser calls S3). Tests can't catch this.

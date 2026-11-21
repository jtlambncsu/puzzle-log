# puzzle-log

Just tracking my puzzles. 🧩

A TypeScript monorepo with a Node/Express API and a React frontend, built with
[npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces).

## Layout

```
apps/
  api/        Express 5 REST API (tsx for dev, tsup for builds, Vitest + Supertest)
  web/        React 19 + Vite frontend (Vitest + React Testing Library)
packages/
  shared/     Types and Zod schemas shared by the API and every client
```

`packages/shared` is consumed as TypeScript source (no build step). Vite compiles it
for the web app, and tsup bundles it into the API build. A future mobile app can import
it the same way.

## Getting started

Requires Node 22+ (`nvm use` picks up `.nvmrc`).

```bash
npm install
npm run dev        # API on :3001, web on :5173 (Vite proxies /api to the API)
```

Open http://localhost:5173.

## Scripts (from the repo root)

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Run API and web together with hot reload |
| `npm test`          | Run all tests                            |
| `npm run lint`      | ESLint across the repo                   |
| `npm run typecheck` | `tsc --noEmit` in every workspace        |
| `npm run build`     | Production builds (`apps/*/dist`)        |
| `npm run format`    | Prettier                                 |

Run one workspace with `-w`, for example `npm run test:watch -w @puzzle-log/web`.
Add a dependency to one workspace with `npm i <pkg> -w @puzzle-log/api`.

## API

| Method | Path               | Notes                       |
| ------ | ------------------ | --------------------------- |
| GET    | `/api/health`      | Health check                |
| GET    | `/api/puzzles`     | List puzzles (newest first) |
| GET    | `/api/puzzles/:id` | Get one puzzle              |
| POST   | `/api/puzzles`     | Create (validated with Zod) |
| DELETE | `/api/puzzles/:id` | Delete                      |

Data is stored in memory for now and resets on restart. Routes depend on the
`PuzzleStore` interface in `apps/api/src/store.ts`, so a database-backed store can
replace it without changing them.

## Roadmap

- [ ] **React practice:** add-puzzle form, puzzle detail view, delete, edit
- [ ] Client-side routing (React Router) and data fetching (TanStack Query)
- [ ] Persistent storage (DynamoDB or Postgres)
- [ ] Photo uploads: presigned S3 URLs, so the client uploads straight to S3
- [ ] Deploy to AWS: web on S3 + CloudFront, API on Lambda + API Gateway (or App
      Runner), infrastructure as code with AWS CDK in `infra/`
- [ ] Auth (Cognito)
- [ ] Mobile app: Expo / React Native in `apps/mobile`, reusing `packages/shared`,
      with the camera used to photograph finished puzzles

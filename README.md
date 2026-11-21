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
infra/        AWS CDK: DynamoDB, S3, Lambda, API Gateway, GitHub deploy role
docs/         Deployment guide
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

| Method | Path               | Notes                        |
| ------ | ------------------ | ---------------------------- |
| GET    | `/api/health`      | Health check                 |
| GET    | `/api/puzzles`     | List puzzles (newest first)  |
| GET    | `/api/puzzles/:id` | Get one puzzle               |
| POST   | `/api/puzzles`     | Create (validated with Zod)  |
| DELETE | `/api/puzzles/:id` | Delete                       |
| POST   | `/api/uploads`     | Get a presigned photo upload |

Locally, data is stored in memory (it resets on restart) and photo uploads are off. In
AWS, the CDK stack sets `PUZZLES_TABLE` and `PHOTOS_BUCKET`, so the same code uses
DynamoDB and S3 (see `apps/api/src/config.ts`).

**Photo flow:**

1. `POST /api/uploads` with `{ "contentType": "image/jpeg" }` returns `{ key, url, fields }`.
2. POST a multipart form to `url` with every entry of `fields`, then the file as `file`.
3. Create the puzzle with `imageKey: key`. Responses include a temporary `imageUrl`.

## Deployment

The API goes to AWS (CDK, deployed by GitHub Actions) and the web app to Vercel. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the one-time setup.

## Roadmap

- [ ] **React practice:** add-puzzle form, puzzle detail view, delete, edit
- [ ] Client-side routing (React Router) and data fetching (TanStack Query)
- [x] Persistent storage (DynamoDB)
- [x] Photo uploads API: presigned S3 POSTs, so clients upload straight to S3
- [x] Deploy: API on Lambda + API Gateway via CDK, web on Vercel
- [ ] **React practice:** photo picker and upload in the add-puzzle form
- [ ] Auth (Cognito)
- [ ] Mobile app: Expo / React Native in `apps/mobile`, reusing `packages/shared`,
      with the camera used to photograph finished puzzles

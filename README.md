# puzzle-log

Just tracking my puzzles. 🧩

A TypeScript monorepo with a Node/Express API and a React frontend, built with
[npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces).

Live at https://puzzle-log-one.vercel.app (sign-in required).

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md): how the pieces fit and request flows
- [Architecture Decision Records](docs/decisions/README.md): why each technology was chosen
- [Deployment guide](docs/DEPLOYMENT.md): one-time AWS, GitHub and Vercel setup
- [Lessons learned](docs/lessons-learned.md): real bugs and how they were found

## Stack

| Area    | Choice                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------- |
| Web     | React 19, Vite, Tailwind CSS v4, shadcn/ui, TanStack Router, TanStack Query, React Hook Form + Zod |
| API     | Express 5 on AWS Lambda + API Gateway                                                              |
| Data    | DynamoDB (per-user partition), S3 for photos                                                       |
| Auth    | Cognito managed login, OIDC code flow + PKCE                                                       |
| Infra   | AWS CDK, deployed by GitHub Actions (OIDC, no stored keys)                                         |
| Hosting | Vercel (web), AWS (API)                                                                            |
| Testing | Vitest, React Testing Library, MSW, Supertest, CDK assertions                                      |

## Layout

```
apps/
  api/        Express API (runs locally as a server, in AWS on Lambda)
  web/        React app
    src/routes/        pages (file-based routing)
    src/features/      feature UI (puzzles)
    src/api/           API client + TanStack Query hooks
    src/components/ui/ shadcn/ui components (generated, ours to edit)
packages/
  shared/     Zod schemas and types shared by the API and clients
infra/        AWS CDK app
docs/         architecture, ADRs, deployment, lessons learned
```

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

| Method | Path                  | Notes                                               |
| ------ | --------------------- | --------------------------------------------------- |
| GET    | `/api/health`         | Health check                                        |
| GET    | `/api/puzzles`        | List puzzles (newest first)                         |
| GET    | `/api/puzzles/:id`    | Get one puzzle                                      |
| POST   | `/api/puzzles`        | Create (validated with Zod)                         |
| PATCH  | `/api/puzzles/:id`    | Update (Merge Patch: `null` removes a field)        |
| DELETE | `/api/puzzles/:id`    | Delete                                              |
| POST   | `/api/uploads`        | Get a presigned photo upload                        |
| GET    | `/api/barcodes/:code` | What product a barcode is (cached UPCitemdb lookup) |

Locally, data is stored in memory (it resets on restart), photo uploads are off, and there
is no login: every request belongs to one dev user. In
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

- [x] Monorepo, CI, AWS + Vercel deployment
- [x] Login (Cognito) with per-user data
- [x] Puzzle list, detail and delete; add-puzzle form with photo upload
- [x] Dates from photo EXIF; bulk add from many photos
- [x] Rotate photos before upload and after saving
- [x] Search, tags, and editing puzzles
- [x] Scan a box's barcode in a store to see if you've done that puzzle
- [ ] Sort the list (by date finished, pieces, title)
- [ ] Playwright smoke tests against the deployed app
- [ ] Mobile app: Expo / React Native in `apps/mobile`, reusing `packages/shared`

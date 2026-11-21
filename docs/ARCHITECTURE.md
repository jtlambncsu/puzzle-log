# Architecture

Puzzle Log is a React single-page app on Vercel that talks to a serverless API on AWS.
Each significant choice has an [ADR](decisions/README.md) explaining why.

```
 Phone / browser
   │  React app (Vercel)
   │
   ├─(1) sign in ───────────► Cognito managed login ──► access token (JWT)
   │
   ├─(2) API calls + JWT ───► API Gateway (HTTP API)
   │                            │  JWT authorizer rejects bad/missing tokens
   │                            ▼
   │                          Lambda: Express app ───► DynamoDB (puzzles, keyed by userId)
   │                            │
   │                            └─ signs S3 upload/view URLs
   │
   └─(3) photo upload ──────► S3 (private bucket, presigned POST)
```

## Repository layout

| Path              | What it is                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | React 19 + Vite. Tailwind + shadcn/ui, TanStack Router + Query, RHF + Zod                                      |
| `apps/api`        | Express 5 API. Runs locally as a server and in AWS on Lambda                                                   |
| `packages/shared` | Zod schemas and types shared by the API and clients                                                            |
| `infra`           | AWS CDK app: Cognito, DynamoDB, S3, Lambda, API Gateway, CI deploy role                                        |
| `docs`            | This overview, [ADRs](decisions/README.md), [deployment](DEPLOYMENT.md), [lessons learned](lessons-learned.md) |

## Request flows

### Signing in

1. The user taps **Sign in**. `oidc-client-ts` generates a PKCE verifier and redirects to
   Cognito's hosted login page.
2. After the password check, Cognito redirects back with a one-time `code`.
3. The app exchanges the code (plus the PKCE verifier) for tokens and stores them in
   `localStorage`. The access token is refreshed in the background.

### Loading the puzzle list

1. TanStack Router matches `/` and runs its **loader**, which calls
   `queryClient.ensureQueryData(puzzlesQueryOptions(api))`.
2. The API client adds `Authorization: Bearer <access token>` and calls `GET /api/puzzles`.
3. API Gateway validates the JWT, then invokes the Lambda with the token's claims.
4. Express reads the user (`sub` claim), queries DynamoDB for that user's partition, and adds
   one-hour signed photo URLs.
5. The page component reads the cached data with `useSuspenseQuery` and renders the grid.

### Adding a puzzle with a photo

1. React Hook Form validates the fields with Zod.
2. The photo is compressed in the browser (canvas, max 2000 px JPEG).
3. `POST /api/uploads` returns a presigned S3 POST for `uploads/<userId>/<uuid>`.
4. The browser uploads the photo directly to S3.
5. `POST /api/puzzles` saves the puzzle with that `imageKey`. The API checks the key belongs
   to the user.
6. The mutation invalidates the `['puzzles']` queries, and the app navigates to the list.

## Local development

`npm run dev` runs the API on :3001 (in-memory storage, no login, uploads off) and the web
app on :5173, which proxies `/api` to the API. No AWS account needed.

## Environments and configuration

| Setting                          | Where it's set              | Used for                             |
| -------------------------------- | --------------------------- | ------------------------------------ |
| `VITE_API_URL`                   | Vercel env vars             | API base URL                         |
| `VITE_COGNITO_*`                 | Vercel env vars             | Login (authority, client ID, domain) |
| `AWS_DEPLOY_ROLE_ARN`            | GitHub repository variable  | CI deploy role                       |
| `WEB_URLS`, `ALLOWED_ORIGINS`    | GitHub variables (optional) | Login redirect URLs, CORS origins    |
| `PUZZLES_TABLE`, `PHOTOS_BUCKET` | Set by CDK on the Lambda    | DynamoDB and S3 names                |

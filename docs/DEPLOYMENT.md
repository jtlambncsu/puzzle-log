# Deployment

The **API runs on AWS** and the **web app runs on Vercel**.

```
Browser / phone ──► Vercel (React app)
       │
       ├──► Cognito managed login ──► access token
       │
       ├──► API Gateway (checks token) ──► Lambda (Express API) ──► DynamoDB (puzzles)
       │                          │
       │                          └── signs upload/view URLs
       └──► S3 (photos, uploaded directly with a presigned POST)
```

| Piece      | Where              | Deployed by                                   |
| ---------- | ------------------ | --------------------------------------------- |
| `infra/`   | AWS CloudFormation | GitHub Actions on every push to `main`        |
| `apps/api` | AWS Lambda         | Same (CDK bundles it with esbuild)            |
| `apps/web` | Vercel             | Vercel's GitHub integration (previews per PR) |

GitHub Actions has no stored AWS keys. It signs in with GitHub's OIDC token and assumes
a role that only workflows on `main` of this repo can use.

## One-time setup

> **No laptop?** Steps 2 and 3 work in **AWS CloudShell**, a terminal in the AWS console
> that's already signed in and has the AWS CLI, Node and git. Open it in a phone browser
> (with "Request desktop site" on), set the region to `us-east-1`, and run:
>
> ```bash
> git clone https://github.com/jtlambncsu/puzzle-log
> cd puzzle-log && npm ci
> cd infra && npx cdk bootstrap && npx cdk deploy PuzzleLogGithubDeploy
> ```
>
> The GitHub settings (step 4) and Vercel (step 6) work in a mobile browser too.

### 1. Prerequisites on your machine

- AWS CLI v2, signed in to your account with admin rights. Check with
  `aws sts get-caller-identity`.
- `npm install` at the repo root.
- Pick a region and use it everywhere. These docs use `us-east-1`.

### 2. Bootstrap CDK (once per account and region)

```bash
cd infra
AWS_REGION=us-east-1 npx cdk bootstrap
```

This creates the `CDKToolkit` stack: an assets bucket and the `cdk-*` roles that
deployments use.

### 3. Create the GitHub deploy role

```bash
AWS_REGION=us-east-1 npx cdk deploy PuzzleLogGithubDeploy
```

Copy the `DeployRoleArn` output.

If it fails because a `token.actions.githubusercontent.com` provider already exists (you
may have set one up for another project), reuse it:

```bash
AWS_REGION=us-east-1 npx cdk deploy PuzzleLogGithubDeploy \
  -c existingOidcProviderArn=arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
```

If you fork or rename the repo, add `-c githubRepo=<owner>/<repo> -c githubOwnerId=<id>
-c githubRepoId=<id>`. The IDs are `owner.id` and `id` from
`https://api.github.com/repos/<owner>/<repo>`. Repos created after July 15, 2026 put them in
GitHub's OIDC token, so the role must know them.

### 4. Tell GitHub about the role

In the repo: **Settings → Secrets and variables → Actions → Variables → New repository
variable**. Use repository variables, not secrets (the workflow reads `vars.*`) and not
environment variables (the deploy job doesn't use a GitHub environment, and the AWS role
only trusts the `main` branch identity):

| Variable              | Value                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | The `DeployRoleArn` from step 3                                                                                                                          |
| `AWS_REGION`          | `us-east-1` (optional; this is the default)                                                                                                              |
| `WEB_URLS`            | Optional. Overrides the web app URLs login may redirect to (comma-separated). Defaults to `https://puzzle-log-one.vercel.app`, set in `infra/bin/app.ts` |

From now on, every push to `main` runs the checks and then the `deploy-api` job.

### 5. Deploy the API

Merge to `main`, or deploy from your machine the first time:

```bash
npm run deploy:api   # from the repo root, with AWS_REGION set
```

Copy the `ApiUrl` output, e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`. It's
also in the `deploy-api` job log and under CloudFormation → `PuzzleLogApi` → Outputs.

Check it: `curl <ApiUrl>/api/health` should return `{"status":"ok"}`.

### 6. Set up Vercel

1. **Add New → Project**, then import this GitHub repo.
2. **Root Directory:** `apps/web`. Vercel detects Vite and the npm workspace.
3. **Environment Variables**, from the `PuzzleLogApi` stack outputs (step 5):

   | Variable                 | Stack output       |
   | ------------------------ | ------------------ |
   | `VITE_API_URL`           | `ApiUrl`           |
   | `VITE_COGNITO_AUTHORITY` | `CognitoAuthority` |
   | `VITE_COGNITO_CLIENT_ID` | `CognitoClientId`  |
   | `VITE_COGNITO_DOMAIN`    | `CognitoDomain`    |

4. Deploy.

Vercel then deploys `main` to production and gives every PR a preview URL. `VITE_*`
variables are baked in at build time, so redeploy after changing one.

### 7. Create your login

Sign-up is turned off, so users are created by hand:

1. AWS console, region **us-east-1** → **Cognito → User pools** → the pool whose **User
   pool ID** matches the `UserPoolId` stack output (its name is generated, like
   `AuthUserPool…`) → **Users → Create user**.
2. Choose **Send an email invitation**, enter your email, check **Mark email address as
   verified**, and let Cognito generate a temporary password.
3. Open the web app, sign in with the emailed password, and choose a new one.

To let someone else in later, create a user for them the same way. Each user only ever
sees their own puzzles and photos.

## Day to day

- Push or merge to `main`: the API deploys from GitHub Actions and the web app from Vercel.
- Open a PR: CI runs and Vercel posts a preview link. The preview talks to the production
  API (there's only one environment for now). You **can't sign in on preview URLs**:
  Cognito only redirects to exact URLs listed in `WEB_URLS`, and preview URLs change.
- Local development needs no login: the local API treats every request as one dev user.
  To test real login locally, put the four `VITE_*` values in `apps/web/.env.local`. The
  local API still ignores the token.
- Preview infrastructure changes locally: `cd infra && npx cdk diff PuzzleLogApi`.
- View API logs: CloudWatch → Log groups → `PuzzleLogApi-ApiLogs…`.

## Troubleshooting

**`Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity`**
means the role's trust policy doesn't match the token GitHub sent. Check, in order:

- The role was deployed from the current code (`npx cdk deploy PuzzleLogGithubDeploy`).
  It trusts both GitHub subject formats: `repo:owner@ID/name@ID:ref:refs/heads/main` and
  the legacy `repo:owner/name:ref:refs/heads/main`.
- The job ran on `main`. The role trusts no other branch, so PR runs can't deploy.

**`redirect_mismatch` on the Cognito login page** means the URL you opened isn't in
`WEB_URLS`. Add it (exactly, no trailing slash) and redeploy the API.

**Everything says "Your session has expired"** right after a deploy usually means the
Vercel build is missing the `VITE_COGNITO_*` variables, so it never signs in. Add them and
redeploy on Vercel.

- IAM → Identity providers has `token.actions.githubusercontent.com` with audience
  `sts.amazonaws.com`.

## Security and cost notes

- **Login:** API Gateway rejects any request without a valid Cognito access token (only
  `/api/health` is public), and the Lambda checks for a user again. Puzzles are stored per
  user, and photos live under `uploads/<userId>/`, so users can't reach each other's data.
- **Limits:** API Gateway throttles to 10 requests per second. Uploads must be images of
  10 MB or less, and upload links expire after 5 minutes. The bucket is private: photos
  are only viewable through 1-hour signed links.
- **Tokens** are kept in the browser's localStorage so you stay signed in. Access tokens
  last 1 hour and refresh automatically for 30 days.

- **CORS** allows any origin by default. Once you have a fixed domain you can set the
  `ALLOWED_ORIGINS` GitHub variable (comma-separated, e.g. `https://puzzles.example.com`),
  but that blocks Vercel preview URLs.
- **Cost:** for personal use this should fit in the AWS free tier or cost cents a month.
  Set up an **AWS Budget** with an email alert (e.g. $5/month) anyway.
- **Data safety:** the DynamoDB table (with point-in-time recovery) and the photo bucket
  are kept even if you delete the stack.

## Tearing down

```bash
cd infra
npx cdk destroy PuzzleLogApi
```

This removes the Lambda and API but **keeps** the table, bucket and user pool. Delete
those by hand in the console if you really want them gone.

When login was added, the puzzles table was replaced with one keyed by user. The old
`PuzzleLogApi-Puzzles…` table (without `ByUser`) is no longer used and can be deleted in
the DynamoDB console.

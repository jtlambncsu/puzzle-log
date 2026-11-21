# 0004. AWS CDK (TypeScript) for infrastructure

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The API needs DynamoDB, S3, Lambda, API Gateway, Cognito and IAM roles. Clicking these
together in the console isn't reviewable or reproducible.

## Decision

Define infrastructure with the **AWS CDK in TypeScript** (`infra/`). CDK synthesizes
CloudFormation, and `cdk deploy` applies it. Two stacks:

- `PuzzleLogApi` — everything the app runs on. Deployed by CI.
- `PuzzleLogGithubDeploy` — the role CI deploys with. Deployed once by hand (it can't deploy
  itself).

Stateful resources (table, bucket, user pool) use `RemovalPolicy.RETAIN`, so deleting the stack
never deletes data. CDK assertion tests check security-relevant properties (private bucket,
authorizer on routes, admin-only sign-up).

## Alternatives considered

- **Terraform / OpenTofu** — multi-cloud and very common in industry; HCL is another language,
  and CDK's higher-level constructs (`table.grantReadWriteData(fn)`) write least-privilege IAM
  for us.
- **SST** — excellent developer experience built on top of these ideas, but another layer to
  learn first.
- **Console clicks** — not reviewable, not reproducible.

## Consequences

- Infrastructure changes go through PRs and CI like code. `npx cdk diff` previews changes.
- CloudFormation limits apply: e.g. changing a DynamoDB key schema means a new table.
- CDK's construct defaults change between versions, so read `cdk diff` before deploying
  upgrades.

## Explaining it in an interview

"Infrastructure is TypeScript in the same repo, so it's reviewed and tested like code. CDK's
`grant` methods generate least-privilege IAM, stateful resources are retained on delete, and
assertion tests pin down the security-critical settings."

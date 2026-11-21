# Architecture Decision Records

An ADR is a short note recording one significant decision: the context, what we chose,
what we rejected and why, and the consequences. They're append-only: when a decision
changes, write a new ADR that supersedes the old one rather than editing history.

New decision? Copy [`0000-template.md`](0000-template.md) to the next number.

| #                                             | Decision                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| [0001](0001-monorepo-npm-workspaces.md)       | Monorepo with npm workspaces                                            |
| [0002](0002-typescript-and-shared-package.md) | TypeScript everywhere, with a shared source-only package                |
| [0003](0003-express-on-lambda.md)             | One Express app running on AWS Lambda                                   |
| [0004](0004-aws-cdk.md)                       | AWS CDK (TypeScript) for infrastructure                                 |
| [0005](0005-github-actions-oidc-deploys.md)   | Deploy from GitHub Actions with OIDC, no stored AWS keys                |
| [0006](0006-hosting-vercel-and-aws.md)        | Web on Vercel, API on AWS                                               |
| [0007](0007-dynamodb-per-user-table.md)       | DynamoDB, one table partitioned by user                                 |
| [0008](0008-photo-uploads-presigned-post.md)  | Photos uploaded straight to S3 with presigned POSTs                     |
| [0009](0009-auth-cognito-oidc-pkce.md)        | Cognito managed login, OIDC code flow + PKCE, JWT at gateway            |
| [0010](0010-ui-tailwind-shadcn.md)            | Tailwind CSS + shadcn/ui                                                |
| [0011](0011-routing-tanstack-router.md)       | TanStack Router                                                         |
| [0012](0012-server-state-tanstack-query.md)   | TanStack Query for server state                                         |
| [0013](0013-forms-react-hook-form-zod.md)     | React Hook Form + Zod                                                   |
| [0014](0014-testing-strategy.md)              | Testing: Vitest, Testing Library, MSW, CDK assertions                   |
| [0018](0018-search-tags-editing.md)           | Search, tags and editing: client-side filtering, URL state, Merge Patch |
| [0019](0019-barcode-scanning.md)              | Barcode scanning: browser decoder, own barcodes first, cached lookup    |
| [0020](0020-offline-pwa.md)                   | Installable, offline-capable app (PWA)                                  |

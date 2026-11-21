# 0005. Deploy from GitHub Actions with OIDC, no stored AWS keys

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

CI needs to deploy to AWS. The traditional approach, an IAM user's access keys stored as a
GitHub secret, means long-lived credentials that can leak and must be rotated.

## Decision

GitHub Actions authenticates to AWS with **OpenID Connect**. Each workflow run gets a
short-lived token from GitHub describing _which repo and branch_ it is; AWS trusts that token
for one role, `puzzle-log-github-deploy`:

- The trust policy only accepts `main` of this repository.
- The role can do nothing except assume the CDK bootstrap roles, which do the deploying.
- Deploys run after the `check` job passes, only on pushes to `main`.

## Alternatives considered

- **Access keys in GitHub secrets** — long-lived, broad, and a classic source of leaks.
- **Deploying from a laptop** — no review gate, and needs local credentials.

## Consequences

- No AWS secret exists anywhere to leak or rotate.
- PR runs can't deploy, even if someone edits the workflow in a PR.
- **Lesson:** since July 2026, GitHub's token `sub` for new repos includes numeric owner and
  repo IDs (`repo:owner@123/name@456:ref:...`). The trust policy accepts both formats. See
  [lessons learned](../lessons-learned.md#github-oidc-subject-format-changed).

## Explaining it in an interview

"CI uses OIDC federation instead of stored keys. GitHub signs a short-lived token saying
which repo and branch is running, and an IAM role trusts only `main` of this repo. There are
no long-lived credentials to leak, and PR builds can't deploy."

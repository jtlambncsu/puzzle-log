# 0007. DynamoDB, one table partitioned by user

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Each user has a modest list of puzzles. Access patterns: list my puzzles, get one, create,
delete. Cost should be ~zero when idle.

## Decision

One **DynamoDB** table, on-demand billing, with partition key `userId` and sort key `id`.
Listing is one `Query` on the user's partition; get and delete use the full key, so one user
can't touch another's items even by guessing IDs. Point-in-time recovery is on, and the table
is retained if the stack is deleted.

The store sits behind a `PuzzleStore` interface with an in-memory implementation for local
development and tests.

## Alternatives considered

- **Postgres (RDS / Aurora Serverless / Neon)** — flexible queries and joins, but a server or
  minimum capacity to pay for, and connection management from Lambda.
- **Partition key `id` only** (the first version) — listing a user's puzzles would need a scan
  or a secondary index. Replaced when login was added.

## Consequences

- Very cheap, fast and fully managed.
- New access patterns (e.g. "sort by completion date", search) need indexes designed up front,
  or client-side sorting while the data is small. The list is currently sorted in memory.
- Changing the key schema means a new table; the original `Puzzles` table was left behind
  (retained) when this one replaced it.

## Explaining it in an interview

"DynamoDB is designed around access patterns. My main one is 'list this user's puzzles', so
`userId` is the partition key: one Query, and data is isolated per user by construction. The
tradeoff versus Postgres is flexibility: new query shapes need new indexes."

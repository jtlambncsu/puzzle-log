# 0024. Album import: duplicate detection in the browser, AI titles on review

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The owner has several hundred photos of finished puzzles, scattered through their camera
roll (now gathered into one album), with many duplicates. The photos show only the finished
puzzle, never the box, and there is no list of names. Bulk add (ADR 0016) still means typing
every title, and at this scale that's the slow part.

## Decision

**Import, then review.**

1. `/puzzles/import` takes the whole album. Each puzzle is saved as done, dated from its
   photo's EXIF, with the placeholder title "Imported puzzle" and `needsReview: true`.
2. `/review` shows one at a time with AI's suggestions filled in: fix, Save & next.

**Duplicates are found in the browser, before uploading:**

- An **exact copy** has the same SHA-256 of the file bytes (`crypto.subtle`).
- A **re-shoot** has a similar _difference hash_: the photo shrunk to 9×8 grey pixels (by
  averaging), one bit per "brighter than the pixel to its right". The number of differing
  bits (Hamming distance) measures how alike two pictures look.
- Two photos are the same puzzle when they're at most 10 bits apart, or at most 16 bits apart
  and taken within 10 minutes. Matches are joined with union-find, so chains group together.
- The summary lists every merged group with thumbnails and a Split button. The largest file
  in a group is uploaded.
- Every photo's hash is saved on the puzzle (`importHashes`). Importing the album again
  skips them, so an interrupted import can be resumed by picking the same photos.

**AI suggestions:**

- `POST /api/puzzles/:id/suggest` asks Claude (`claude-sonnet-5-5`, effort `low`) to name the
  puzzle from its photo. It uses vision with the photo as a short-lived S3 URL, and
  structured outputs (`messages.parse` with a Zod schema) for `{ title, brand, tags }`.
- Your existing tags are in the prompt, so suggestions reuse your spelling.
- Server-side refusal fallbacks are on (`fallbacks: "default"`).
- The output is cleaned through the shared schemas, so a suggestion can always be saved.
- It only works on puzzles still waiting for review, so it can never overwrite your edits.
- **The review screen asks for suggestions, not the import.** It requests them for the next
  four puzzles with `useQueries`, so they're usually ready on arrival, and only reviewed
  puzzles cost anything. A POST modelled as a query is deliberate: one request per puzzle
  however often the page renders, plus status for free. Retries are off and results never go
  stale, because each call costs money. These results aren't persisted to IndexedDB: they're
  saved on the puzzle anyway.
- **Merging:** "Same puzzle as ‘…’" merges a missed re-shoot into the previously saved
  puzzle (its hashes move over; the duplicate is deleted). The queue is sorted by date, so
  re-shoots come up next to each other.
- **The key** lives in SSM Parameter Store as a SecureString, created by hand in CloudShell.
  The Lambda reads it on first use. It never passes through code, CI or CloudFormation.
  Without it, suggestions answer 503 and the review screen says to type a title.
- The Lambda timeout went from 10 s to 29 s. API Gateway waits at most 30 s, and the
  Anthropic client gets one 25 s attempt.

## Alternatives considered

- **Match photos to an online puzzle database** — no reliable public API identifies a puzzle
  from a picture of it finished. A vision model is the practical way to name it.
- **Suggest during import (server-side queue, SQS)** — would name everything unattended, but
  needs a queue, a worker and progress tracking. Asking ahead on the review screen hides the
  wait almost as well, with no new infrastructure.
- **Upload everything, find duplicates on the server** — would upload every duplicate (slow
  on a phone, and storage). Hashing locally only reads files that are already on the phone.
- **A perceptual-hash library** — a difference hash is about 40 lines and easy to explain.
  Libraries for browsers are small and unmaintained or Node-only.
- **Secrets Manager for the key** — rotation features we don't need, at $0.40 a month.
  Parameter Store SecureString is free and also encrypted with KMS.
- **Model choice.** This first shipped on Claude Opus 5.5, at about 1.5 cents a photo. The
  owner switched to Claude Sonnet 5.5 (about 0.7 cents a photo, around $2 for 300). Naming a
  picture doesn't need the most capable model, and Sonnet recognizes known artwork nearly as
  well. Claude Haiku 5.5 (about 0.05 cents) was the cheaper option, but more likely to fall
  back to generic titles. Changing the model is a one-line change in
  `apps/api/src/suggestions/claude.ts`.

## Consequences

- A few hundred puzzles become a couple of evenings of quick checks instead of typing.
- Decoding hundreds of full-size photos takes a minute or two on a phone. It runs two at a
  time to limit memory, with a progress bar.
- Thresholds were measured on test photos, not tuned on the real album. The Split button
  (before import) and "Same puzzle as…" (during review) cover the mistakes either way.
- Suggestions depend on Anthropic being reachable and on credit in that account.
- The import page must stay open while uploading. Picking the same photos again resumes it.

## Explaining it in an interview

"Duplicate detection runs entirely in the browser: a SHA-256 for exact copies and a
difference hash for near-duplicates, grouped with union-find, so we never upload the
duplicates. Then a review queue uses Claude's vision and structured outputs to pre-fill each
title. TanStack Query prefetches suggestions a few items ahead, so the user rarely waits, and
we only pay for what's actually reviewed."

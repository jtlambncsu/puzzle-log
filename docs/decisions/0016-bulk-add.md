# 0016. Bulk add: field arrays, bounded concurrency, partial-failure retries

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The owner has a backlog of puzzle photos. Adding them one form at a time is slow. Bulk add
should let them pick many photos at once and mostly just type titles.

## Decision

A `/puzzles/bulk` page (`BulkAddForm.tsx`):

- **React Hook Form `useFieldArray`** manages one row per photo. Each row stores its `File`
  plus title, pieces and date. Rows reuse the single form's validation rules
  (`puzzleFormSchema.pick(...).extend({ photo })`). `field.id` is the stable React key and the
  key for per-row status, so statuses follow the right row after removals.
- **Dates from EXIF** per photo ([0015](0015-photo-date-from-exif.md)). Rows are found by
  their `File` when the async read finishes, because indexes can change in the meantime.
- **Bounded concurrency:** saves run 3 at a time (`mapWithConcurrency`). Each save is the
  same `savePuzzle` the single form uses (compress → presign → S3 → create).
- **Partial failures:** each row shows Saving / Saved / its error. Saved rows lock and are
  skipped on retry, so tapping Save again never creates duplicates. If everything saved, the
  app returns to the list.
- **One cache invalidation** after the batch, instead of a list refetch per puzzle.
- Up to 30 photos per batch, to bound memory and upload time on a phone.

## Alternatives considered

- **`Promise.all` over every photo** — 30 simultaneous uploads compete for a phone's bandwidth,
  so every upload is slow and failures are more likely.
- **One at a time** — simplest, but leaves bandwidth unused.
- **A batch API endpoint** — photos must go to S3 individually anyway (presigned per key), so
  batching the small JSON saves wouldn't save much. Worth revisiting if the API gains
  per-request overhead.
- **Uploading in the background after leaving the page** (service worker, or a queue in
  IndexedDB) — more resilient to closing the tab, but much more complex. A good future step.
- **A TanStack Query mutation per row** — works, but per-row `onSuccess` invalidation means
  N refetches; a plain async function plus one invalidation is simpler.

## Consequences

- Fast entry for a backlog: pick photos, type titles, save.
- Leaving the page mid-save stops the remaining uploads; rows already saved stay saved.
- Rows are a flat list of cards. A very large batch would benefit from virtualization
  (e.g. TanStack Virtual), unnecessary at 30.

## Explaining it in an interview

"Bulk add uses `useFieldArray` for a dynamic list of rows, keyed by stable IDs so per-row
state survives removals. Uploads run through a small concurrency pool of three, each row
tracks its own status, and saved rows are skipped on retry, so a flaky connection never
creates duplicates. The cache is invalidated once at the end, not per item."

# 0021. Puzzle status: done, owned, wishlist

- **Status:** Accepted (extended with an in-progress status by [0023](0023-puzzle-timer.md))
- **Date:** 2026-11-21

## Context

In a shop, "have I done this?" isn't the only question: buying a second copy of a puzzle
already on the shelf is just as annoying, and it's useful to remember puzzles you want.

## Decision

An optional `status` on each puzzle: `done`, `owned` (have it, not done) or `wishlist`. A
missing status means `done`, so every puzzle saved before this change keeps its meaning with
no data migration (`puzzleStatus()` in `packages/shared`).

- Forms use a segmented control (shadcn `ToggleGroup`, a radio group for screen readers);
  "Finished on" only shows, and is only saved, for done puzzles.
- The list filters by status (in the URL, like search and tags); cards badge non-done puzzles.
- One-tap transitions on the detail page: wishlist → owned ("I bought it"), owned → done
  ("Mark as done", dated today in the user's time zone).
- Scans report the strongest match: done, else "you already own this", else "it's on your
  wishlist". Unknown boxes can be added straight to the wishlist.

## Alternatives considered

- **Separate lists/tables for wishlist and owned** — more structure to keep in sync; moving a
  puzzle between them would mean delete + create.
- **Booleans (`owned`, `done`)** — allow impossible combinations; one enum makes states
  explicit.
- **A data migration setting `status: 'done'` everywhere** — unnecessary: treating missing as
  done is simpler and can't fail halfway.

## Consequences

- Stats and "finished per year" count only done puzzles.
- New statuses (e.g. "lent out") would need adding to the shared enum and the UI's label map.

## Explaining it in an interview

"I modelled status as a single enum rather than booleans so impossible states can't exist,
and made the field optional with 'missing means done', which avoided a data migration. The
status drives the list filters, quick actions and the scan verdict."

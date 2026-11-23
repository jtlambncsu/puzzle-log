# 0032. Ratings: how a finished puzzle went

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The owner wants to remember how each finished puzzle went: whether they liked it, how hard
it was, whether pieces were missing, and whether they'd do it again. Notes already exist.

## Decision

- **Four optional fields** on a puzzle:
  - `rating`: 1 to 5
  - `difficulty`: easy, medium or hard
  - `missingPieces`: a count, 0 to 10,000
  - `wouldRedo`: true or false
  - They're validated by the shared Zod schema. Like other optional fields, `null` in a
    PATCH clears them (JSON Merge Patch).
- **They only apply to finished puzzles.** The form shows a "How was it?" group only when
  the status is Done, and doesn't save these fields otherwise, as with "Finished on".
- **Inputs:**
  - **Stars:** a radio group of five 40px buttons. Tapping the chosen star again clears it.
  - **Difficulty and "Do it again?":** segmented controls (shadcn ToggleGroup). Tapping the
    chosen option clears it, so "not answered" is always possible.
  - **Missing pieces:** a numeric field.
  - The form keeps "no answer" as `0` or `''`, and converts to `undefined` or `null` for
    the API.
- **Display:**
  - stars on cards and on the puzzle page, which also shows difficulty, missing pieces
    and "would do again"
  - extra columns in the spreadsheet backup
- **Stats:**
  - **Favorites:** finished puzzles rated 4 or 5, best and most recent first, with the
    average rating.
  - **Pace by difficulty:** pieces an hour for each difficulty, from timed puzzles with a
    piece count (total pieces over total time, so big puzzles weigh more).

## Alternatives considered

- **Half stars, or a 1–10 score:** more precise than anyone remembers a puzzle. Five stars
  is familiar.
- **Difficulty as 1–5:** three words are quicker to choose and easier to compare across
  puzzles.
- **Free-text tags for difficulty ("hard"):** the existing tags would work for searching,
  but structured values make the stats possible.

## Consequences

- Imported puzzles have no rating until edited. Stats only use what's filled in.
- Card heights grow slightly with stars. The virtualized list measures rows, so nothing
  overlaps.

## Explaining it in an interview

"The form state uses UI-friendly sentinels (0 stars, empty strings), and the conversion to
the API's schema turns them into undefined for create and null for a merge-patch edit. The
star rating is a proper radio group with aria-checked, so it works with screen readers
and the keyboard, not only by tapping."

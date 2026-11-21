# 0018. Search, tags and editing: client-side filtering, URL state, JSON Merge Patch

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The main real-world use is standing in a shop holding a puzzle box and checking "have I
already done this one?". That needs fast search from a phone, plus grouping (e.g. all Star
Wars puzzles). Grouping existing puzzles also requires editing them.

## Decision

**Tags:** an optional list of short strings on each puzzle (`tagsSchema` in
`packages/shared`): trimmed, up to 20, duplicates removed ignoring case. The tag input
suggests tags already in use so spellings stay consistent. Bulk add has "Tags for all photos".

**Search:** a box on the list page that matches every typed word against title, brand,
notes, tags and piece count, ignoring case and accents (`src/lib/search.ts`). Tag chips with
counts filter to one tag; chip labels use each tag's most common spelling.

**Filter in the browser.** The whole list is already loaded (and cached by TanStack
Query), and a personal collection is at most a few thousand items, so filtering on every
keystroke is instant and works offline from cache. No API change was needed.

**Filters live in the URL** (`/?q=hoth&tag=Star+Wars`) via TanStack Router `validateSearch`
with a Zod schema: back/forward, refresh and bookmarks keep them, links to filtered views are
type-checked, and invalid values are dropped (`.catch`). Typing uses `replace` navigation so
it doesn't flood browser history. The schema accepts numbers too, because the router's URL
parser turns `?q=1000` into a number.

**Editing** (`/puzzles/$puzzleId/edit`) reuses the puzzle form and sends
`PATCH /api/puzzles/:id` as a **JSON Merge Patch** (RFC 7396): omitted fields are unchanged,
`null` removes a field. The edit form sends every field, with blanks as `null`. DynamoDB
updates translate this into `SET` and `REMOVE` clauses.

## Alternatives considered

- **Server-side search** (DynamoDB scan with filters, or OpenSearch) — needed for large or
  shared datasets; overkill for one person's list, and slower on a phone than filtering a
  cached list.
- **Fuzzy search (e.g. Fuse.js)** — tolerates typos, but returns surprising matches for short
  queries. Word-prefix-free substring matching is predictable; Fuse.js is easy to add later.
- **Filters in component state** — simpler, but lost on refresh or back, and not linkable.
- **Separate "tags" table or a GSI for tags** — useful for server-side tag queries; not needed
  while filtering client-side.
- **PUT (replace the whole puzzle)** — simpler semantics, but clients must send every field,
  including ones they don't edit (like `imageKey`), which invites accidental overwrites.

## Consequences

- Search is instant and needs no backend work, but scales only as far as the list fits on the
  client. If that ever changes, the same URL parameters can drive a server-side query.
- Tags are free text: consistency relies on suggestions, and case-insensitive matching.
- `UpdatePuzzleInput` allows `null`; any new optional field must be added to the update
  schema to be clearable.

## Explaining it in an interview

"Search state lives in the URL, validated by a Zod schema in the router, so filtered views
survive refresh and are shareable. Because the dataset is small and already cached, filtering
happens client-side on every keystroke. Edits use JSON Merge Patch, where null deletes a field,
which maps neatly onto DynamoDB's SET and REMOVE update clauses."

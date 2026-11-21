# 0023. Puzzle timer: server clock, sessions, conditional writes

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The owner wants to track a puzzle while working on it: the date it was started, and a timer
that can be paused and resumed across evenings. Puzzling happens in short bursts on a phone
that gets locked, put down, or swapped for another device. A timer that lived only in the
open page would stop or be lost whenever that happened.

## Decision

- **A fourth status, `in_progress`,** between owned and done, plus an optional `startedAt` date
  (the user's local date, like `completedAt`).
- **The running timer is a timestamp on the server.** `POST /api/puzzles/:id/timer/start`
  stores `timerStartedAt` using the API's clock. `POST .../timer/stop` turns it into a
  finished session `{ start, end }` appended to `sessions`. The page computes "now minus
  start" and redraws every second (`useNow`); nothing has to keep running on the phone.
- **Timer and status stay consistent.** Starting the timer moves the puzzle to in progress and
  sets `startedAt` if it's missing (the client sends its local `today`, because the server
  doesn't know the user's time zone). Changing the status to anything else, e.g. "Mark as
  done", stops the timer and saves the session in the same write.
- **Commands, not a generic PATCH, for start and stop.** `timerStartedAt` can't be set
  through PATCH, and the API, not the client, decides the times.
- **Optimistic concurrency.** Start and stop read the puzzle, then write with a DynamoDB
  condition: `attribute_not_exists(timerStartedAt)` to start, `timerStartedAt = :whatIRead`
  to stop. If the condition fails, another tap or device got there first. The API then
  returns the latest puzzle instead of an error, so pressing Start or Pause twice is
  harmless (idempotent). `ReturnValuesOnConditionCheckFailure` tells "changed" apart from
  "missing".
- **Sessions can be corrected.** Forgot to pause overnight? Delete that session (with Undo) or
  add time by hand. Both send the whole `sessions` list through the normal JSON Merge Patch;
  arrays are replaced, not merged. At most 1,000 sessions keeps the list under the API's
  100 KB body limit and DynamoDB's 400 KB item limit.
- **The timer needs a connection.** Its buttons are disabled offline, and the mutation uses
  `networkMode: 'always'`. TanStack Query's default would pause the request until the phone
  reconnects and then record the wrong time.
- Totals, pace (pieces an hour) and stats use pure helpers in `packages/shared/src/timer.ts`.

## Alternatives considered

- **Timer state only in the browser (`localStorage` or IndexedDB)** — simplest, and works
  offline, but it's tied to one device and lost if the site data is cleared. It also needs
  syncing to the server anyway to show totals elsewhere.
- **Client-sent timestamps through PATCH** — fewer endpoints, but two devices or a double tap
  could overwrite each other's sessions, and a phone with a wrong clock would record wrong
  times.
- **A separate `Sessions` table (one item per session)** — scales without limit and allows
  queries by date, but every puzzle read would need a second query. A puzzle never has more
  than a handful of sessions, so a list on the item is simpler and faster.
- **Optimistic UI for Start and Pause** — feels instant, but the server picks the time. The
  request takes a fraction of a second, so a spinner is honest and simpler.
- **A version number on every puzzle for optimistic locking** — the textbook general approach.
  Only the timer needs it so far, and `timerStartedAt` already acts as the version.

## Consequences

- The timer survives closing the app, locking the phone and switching devices.
- Start and Pause need a connection. Offline puzzling has to be added afterwards with "Add
  time".
- A session's times are the API's clock (UTC); the app shows them in the phone's time zone.
- Changing sessions through the edit form isn't supported; the timer card is the one place to
  correct them.
- If the item layout ever moves to a separate sessions table, the shared helpers and the
  `{ start, end }` shape stay the same.

## Explaining it in an interview

"The running timer is just a start timestamp stored on the server, so the client only renders
'now minus start' and nothing needs to keep running on the phone. Start and stop are
idempotent commands implemented as conditional writes in DynamoDB, which is optimistic
concurrency control: if a double tap or a second device changed the timer first, the write
fails, and we return the current state instead of recording a session twice."

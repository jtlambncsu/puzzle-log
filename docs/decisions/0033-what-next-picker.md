# 0033. "What should I do next?": a random pick with filters in the URL

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The owner has a shelf of owned puzzles they haven't started, and choosing the next one is
part of the fun. They wanted a button that picks one, optionally by size or theme.

## Decision

- **A `/next` page** (from More) picks a random puzzle with status Owned.
- **Filters:**
  - a maximum piece count (any, 500, 1,000 or 1,500). Puzzles without a piece count still
    qualify, so a missing number doesn't hide them.
  - a tag, chosen from the tags on the owned pile
- **The filters live in the URL** (`?max=1000&tag=Disney`), validated with Zod in
  `validateSearch`, as on the list page. A favourite combination can be bookmarked, and bad
  values are dropped rather than shown as errors.
- **Pick again never repeats the puzzle just shown**, unless it's the only one.
- The pick happens in a click handler, not during render, so React re-rendering can't
  reshuffle it.
- The pick shows the usual card plus the existing **Start puzzle** button, which starts the
  timer and moves the puzzle to In progress.
- The picking rules are a pure function with an injectable random source, tested
  deterministically.

## Alternatives considered

- **Weighted picks (older purchases first, or favourite brands):** more clever, harder to
  explain, and the owner asked for randomness.
- **Keeping the filters in component state:** simpler, but lost on refresh, and they can't
  be bookmarked.

## Consequences

- No API or data changes.
- The same pick logic could later feed a home-page shortcut or a widget.

## Explaining it in an interview

"Randomness is a side effect, so it lives in an event handler with an injectable RNG, which
makes the logic deterministic in tests. Filters are URL state validated by Zod through
TanStack Router, so they survive refreshes and are type-checked wherever links are built."

# 0022. Stats page: stat tiles, one-series column chart (Recharts via shadcn), ranked bars

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

A stats page is fun for a hobby log and good charting practice. It should read well on a
phone, in light and dark mode, and stay accessible.

## Decision

Following the data-visualization procedure (form first, color last, validate, render and look):

- **Headline numbers are stat tiles, not charts** (puzzles done, pieces placed, done this
  year, owned, wishlist).
- **Puzzles finished per year** is a column chart with **shadcn/ui's chart component on
  Recharts**: one series, so one hue and no legend (the title names it); columns capped at
  24px with 4px rounded tops; values on the caps; recessive solid hairline grid; tooltip on
  hover/tap; a "Show as a table" view with the same numbers; missing years filled with zero;
  undated puzzles counted and mentioned rather than silently dropped. Animation is skipped
  for `prefers-reduced-motion`.
- **Favorite brands / top tags** are ranked bar lists in plain HTML (label, proportional bar,
  value at the tip), which keep long names readable on a phone.
- The series color (`--series-1`: `#2a78d6` light, `#3987e5` dark) comes from a validated
  reference palette and was checked with the palette validator against this app's light page
  and dark card surfaces.
- All numbers come from a pure, unit-tested `puzzleStats()` (only finished puzzles count).

## Alternatives considered

- **Charts for every number** — a single value reads faster as a figure.
- **Chart.js / Nivo / Visx** — fine libraries; Recharts is the most common in React codebases
  and shadcn wraps it with theming that follows our dark mode.
- **Pie chart of statuses** — parts of a whole across only three values read better as the
  three numbers themselves.

## Consequences

- Recharts adds ~100 KB (gzipped) to the stats page's chunk only (route code-splitting).
- jsdom can't lay out Recharts, so tests assert the tiles, lists and table view; the chart
  itself was checked visually in light and dark mode.

## Explaining it in an interview

"I chose the form per number: tiles for headline figures, a single-series column chart for
the trend, and ranked bars for categories with long names. The chart has a table fallback and
a validated color for both themes, and the numbers come from a pure function with tests."

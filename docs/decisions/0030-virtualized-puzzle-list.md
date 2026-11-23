# 0030. Virtualized puzzle list with TanStack Virtual

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

After the album import, the home page lists several hundred puzzles, each a card with a
photo. Rendering every card means thousands of DOM nodes and hundreds of images to lay out,
which makes scrolling and filtering heavier on a phone as the collection grows. Images
already load lazily, so the cost is the DOM and layout, not the downloads.

## Decision

- **TanStack Virtual's window virtualizer** (`useWindowVirtualizer`): only the rows near
  the screen are rendered (about 10 to 20 cards out of 400 in testing), and the page itself
  still scrolls, so it behaves like a normal page.
- **Rows, not cards, are virtualized.** The grid has 2 or 3 columns (CSS, Tailwind's `sm`
  breakpoint), and `useColumns` reads the same media query with `useSyncExternalStore`, so
  rows always match the CSS.
- **Rows are measured** (`measureElement`), so titles that wrap to two lines don't break the
  layout. The estimate is computed from the screen width (a square photo per column plus
  the text), which keeps the total height close before rows are measured.
- **Accessibility:** absolutely positioned rows can't be a `<ul>`, so the container has
  `role="list"`, and each card has `role="listitem"` with `aria-setsize` and
  `aria-posinset`. A screen reader still hears "item 5 of 400".
- `decoding="async"` on card photos keeps image decoding off the main thread while
  scrolling.

## Alternatives considered

- **Pagination or "Load more":** simple, but searching and browsing a collection works
  better as one list, and it changes how the page behaves.
- **CSS `content-visibility: auto`:** skips painting off-screen cards with one line of CSS,
  but every card is still in the DOM and React still renders all of them.
- **react-window or react-virtuoso:** both established, but TanStack Virtual matches the
  rest of the stack (TanStack Query, Router), is headless (our own markup and Tailwind
  classes), and supports measured, variable-height rows directly.

## Consequences

- Rendering cost stays roughly constant however large the collection gets.
- Coming back to the list restores the scroll position to within a fraction of a row
  (measured: 24 px off after scrolling 20,000 px), because rows above are re-measured.
- Browser find-in-page (Cmd+F) only sees rendered cards; the app's own search covers the
  whole list.
- Tests: jsdom has no layout, so the test that checks virtualization gives elements a
  height (`offsetHeight`, which the virtualizer reads).

## Explaining it in an interview

"The list virtualizes rows with TanStack Virtual's window virtualizer, so a 400-card grid
keeps about 15 cards in the DOM. Column count comes from the same breakpoint as the CSS
grid via useSyncExternalStore, rows are measured for variable heights, and ARIA setsize
and posinset keep the list semantics a virtualized DOM would otherwise lose."

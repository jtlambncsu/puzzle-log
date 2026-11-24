# 0035. Visual refresh: warm theme, serif headings, bottom tab bar

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The app used shadcn/ui's default neutral theme: grayscale, one sans-serif font, and every
action in a top bar. It worked, but it looked generic, and on a phone the main actions
(Add, Scan, Stats, More) sat at the top of the screen, the hardest place for a thumb to
reach. The owner asked for a more refined layout.

## Decision

- **A warm theme, as design tokens.** Only the CSS variables shadcn/ui reads are changed
  (`--background`, `--primary`, ...), for light and dark:
  - a "paper" off-white background with white cards
  - a deep teal accent for primary actions and the selected tab
  - warm grays for text and borders

  No component's code changes for the colors, and the browser bar's color
  (`theme-color`) and the installed app's manifest match the new background.

- **A serif for headings (Fraunces) with Geist for text.** It's a popular open-source
  variable font, installed from npm through Fontsource like Geist (no Google Fonts
  request), and used only through `--font-heading`.
- **A floating bottom tab bar** (`AppNav`): Puzzles, Stats, a round Add button, Scan, More.
  - It sits above the iPhone home indicator using `env(safe-area-inset-bottom)`, which
    needs `viewport-fit=cover`.
  - The active tab uses the router's `data-status="active"` attribute, so there's no
    active-state logic of our own.
  - The top bar keeps only the title and Sign out.
- **Clearer pages:**
  - Puzzle cards show status as a colored badge (amber In progress, blue Owned, rose
    Wishlist) and line up rating and date at the bottom.
  - A puzzle's page puts the title first and its details in a labeled grid (Pieces,
    Brand, Started, Finished, Barcode). An in-progress puzzle shows its timer before
    the photo, since that's what you use while working on it.
  - Delete is a quiet text button at the bottom.
  - The add/edit form sits on a card, and the tools on More are a grouped list with
    icon tiles.

## Alternatives considered

- **A ready-made theme (a shadcn "theme" preset):** a quick color swap, but it doesn't
  change navigation or page layout, which were the bigger problems on a phone.
- **A top navigation bar on wide screens and a bottom bar on phones:** two navigations
  to keep in sync (and duplicate links for screen readers and tests). The floating
  bar, centered and width-limited, works on both.
- **Tailwind color classes everywhere instead of tokens:** harder to keep consistent
  and to do dark mode for. Tokens change everything in one place.

## Consequences

- Pages need bottom padding so the tab bar never covers the last item (set once in the
  root layout).
- Fraunces adds about 100 KB of font files, cached by the service worker after the first
  visit.
- The status badge colors are Tailwind's palette, with their own dark-mode shades.

## Explaining it in an interview

"I treated the redesign as design tokens plus layout. shadcn/ui components read CSS
variables, so a theme change is a handful of OKLCH values for light and dark mode, not
edits to every component. The biggest usability win was moving navigation to a bottom
tab bar where a thumb can reach it, respecting the iPhone safe area, and letting the
router's active-link attribute drive the styling. Content order now follows what the
user does: on an in-progress puzzle, the timer comes before the photo."

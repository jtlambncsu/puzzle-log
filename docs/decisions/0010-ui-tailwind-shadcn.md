# 0010. Tailwind CSS + shadcn/ui

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The app needs accessible, good-looking components (buttons, forms, dialogs, toasts) and a
styling approach that's productive, popular, and could carry to a React Native app later.

## Decision

- **Tailwind CSS v4** for styling (utility classes, configured in CSS, via `@tailwindcss/vite`).
- **shadcn/ui** (Radix primitives, "Nova" preset) for components. shadcn copies component
  source into `src/components/ui/`, so we own and can read or modify it. Add components with
  `npx shadcn@latest add <name>` from `apps/web`.
- Light/dark follows the device setting via a small script in `index.html`.

## Alternatives considered

- **Material UI** — huge component set and common in enterprise, but heavier, harder to make
  not look like Google, and doesn't carry to React Native.
- **Mantine** — very productive, less common in job listings.
- **Using MUI and Tailwind together** — two competing styling systems.
- **CSS Modules / plain CSS** — fine, but slower to build consistent UI.

## Consequences

- Components are our code: upgrades are manual (re-run `shadcn add`), but nothing is hidden.
- Accessibility (focus traps, ARIA, keyboard support) comes from Radix.
- Tailwind can carry to mobile via NativeWind; shadcn components themselves can't, though
  React Native ports exist.
- shadcn's CLI pulls from `ui.shadcn.com`; the `puzzle-log` cloud environment allows that host.

## Explaining it in an interview

"Tailwind keeps styling next to markup and avoids naming and specificity problems. shadcn/ui
isn't a dependency; it copies accessible Radix-based components into the repo, so I own the
code and can change anything, which is why it's become the default in modern React."

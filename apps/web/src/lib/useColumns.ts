import { useSyncExternalStore } from 'react';

/** Tailwind's `sm` breakpoint, where the puzzle grid goes from 2 to 3 columns. */
const WIDE = '(min-width: 40rem)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** How many columns the puzzle grid has, matching its CSS (2, or 3 from `sm` up). */
export function useColumns() {
  return useSyncExternalStore(subscribe, () => (window.matchMedia(WIDE).matches ? 3 : 2));
}

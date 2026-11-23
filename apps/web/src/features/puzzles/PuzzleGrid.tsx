import { useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Puzzle } from '@puzzle-log/shared';
import { useColumns } from '@/lib/useColumns';
import { PuzzleCard } from './PuzzleCard';

const GAP = 12;
/** The page's content width: `max-w-3xl` (48rem) minus `px-4` on each side. */
const MAX_CONTENT_WIDTH = 768 - 32;
/** A card's text under its square photo: title, pieces and brand, finished date. */
const TEXT_HEIGHT = 110;

/**
 * A row's height before it's measured: a square photo as wide as a column, plus the text.
 * Close estimates matter: when you come back to the list, the browser restores the scroll
 * position before the rows above are measured, so each row's error adds up.
 */
function estimateRowHeight(columns: number) {
  const width = Math.min(window.innerWidth - 32, MAX_CONTENT_WIDTH);
  return (width - GAP * (columns - 1)) / columns + TEXT_HEIGHT;
}

/**
 * The puzzle grid, virtualized: only the rows near the screen are rendered, so scrolling
 * stays smooth with hundreds of photo cards. The page itself scrolls (a window
 * virtualizer), so it feels like any other page, and each row's real height is measured.
 *
 * Rows are positioned absolutely, so list semantics come from roles rather than <ul>, and
 * each card says where it is in the whole list ("5 of 400") for screen readers.
 */
export function PuzzleGrid({ puzzles }: { puzzles: readonly Puzzle[] }) {
  const columns = useColumns();
  // Where the grid starts on the page, measured when it mounts (via a callback ref).
  const [offsetTop, setOffsetTop] = useState(0);
  const rows = Math.ceil(puzzles.length / columns);
  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => estimateRowHeight(columns),
    gap: GAP,
    overscan: 3,
    scrollMargin: offsetTop,
  });

  return (
    <div
      ref={(element) => {
        if (element) setOffsetTop(element.getBoundingClientRect().top + window.scrollY);
      }}
      role="list"
      aria-label="Puzzles"
      className="relative mt-4"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          role="presentation"
          className="absolute inset-x-0 top-0 grid grid-cols-2 gap-3 sm:grid-cols-3"
          style={{ transform: `translateY(${row.start - offsetTop}px)` }}
        >
          {puzzles.slice(row.index * columns, (row.index + 1) * columns).map((puzzle, i) => (
            <div
              key={puzzle.id}
              role="listitem"
              aria-setsize={puzzles.length}
              aria-posinset={row.index * columns + i + 1}
            >
              <PuzzleCard puzzle={puzzle} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

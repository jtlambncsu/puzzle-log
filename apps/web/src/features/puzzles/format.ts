import type { Puzzle } from '@puzzle-log/shared';

/** "1,000 pieces · Ravensburger" */
export function puzzleSubtitle(puzzle: Pick<Puzzle, 'pieceCount' | 'brand'>) {
  return [puzzle.pieceCount && `${puzzle.pieceCount.toLocaleString()} pieces`, puzzle.brand]
    .filter(Boolean)
    .join(' · ');
}

/** Formats a YYYY-MM-DD date without the time-zone shift `new Date('2026-01-05')` causes. */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

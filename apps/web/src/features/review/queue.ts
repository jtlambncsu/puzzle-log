import type { Puzzle } from '@puzzle-log/shared';

/**
 * Imported puzzles waiting for review, oldest photo first, so several photos of one puzzle
 * that weren't merged on import come up one after another ("Same puzzle as the last one").
 */
export function reviewQueue(puzzles: readonly Puzzle[]) {
  return puzzles
    .filter((puzzle) => puzzle.needsReview)
    .sort(
      (a, b) =>
        (a.completedAt ?? '9999').localeCompare(b.completedAt ?? '9999') ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

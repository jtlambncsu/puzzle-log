import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
import { hasTag } from './search';

export interface PickFilters {
  /** At most this many pieces. Puzzles without a piece count still qualify. */
  maxPieces?: number;
  tag?: string;
}

/** Owned puzzles not started yet that match the filters: the pile to pick from. */
export function pickCandidates(puzzles: readonly Puzzle[], { maxPieces, tag }: PickFilters) {
  return puzzles.filter(
    (puzzle) =>
      puzzleStatus(puzzle) === 'owned' &&
      (!maxPieces || !puzzle.pieceCount || puzzle.pieceCount <= maxPieces) &&
      (!tag || hasTag(puzzle, tag)),
  );
}

/**
 * A random puzzle from the candidates, avoiding the one just shown when there's another
 * choice ("Pick again" should always show something new). `random` is injectable for tests.
 */
export function pickNext(
  candidates: readonly Puzzle[],
  previousId?: string,
  random: () => number = Math.random,
): Puzzle | undefined {
  const pool =
    candidates.length > 1 ? candidates.filter((puzzle) => puzzle.id !== previousId) : candidates;
  return pool[Math.floor(random() * pool.length)];
}

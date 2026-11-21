import {
  piecesPerHour,
  puzzleStatus,
  totalTimeMs,
  type Puzzle,
  type PuzzleStatus,
} from '@puzzle-log/shared';
import { tagCounts } from './search';

export interface YearCount {
  year: string;
  count: number;
}

export interface RankedCount {
  name: string;
  count: number;
}

export interface PuzzleStats {
  statusCounts: Record<PuzzleStatus, number>;
  /** Sum of piece counts of finished puzzles that have one. */
  piecesPlaced: number;
  doneThisYear: number;
  /** Every year from the first to the last finish, including years with none. */
  perYear: YearCount[];
  /** Finished puzzles without a finished date (not in `perYear`). */
  undated: number;
  /** Time on every puzzle's timer, finished or not (running timers count up to `now`). */
  timeSpentMs: number;
  /**
   * Pieces an hour across finished puzzles that were timed and have a piece count: their
   * pieces over their time, so a big puzzle counts for more than a small one.
   */
  piecesPerHour?: number;
  topBrands: RankedCount[];
  topTags: RankedCount[];
}

/** Everything the stats page shows, from the puzzle list. Only finished puzzles count. */
export function puzzleStats(puzzles: readonly Puzzle[], now = new Date(), top = 8): PuzzleStats {
  const statusCounts: Record<PuzzleStatus, number> = {
    done: 0,
    in_progress: 0,
    owned: 0,
    wishlist: 0,
  };
  for (const puzzle of puzzles) statusCounts[puzzleStatus(puzzle)]++;

  const done = puzzles.filter((puzzle) => puzzleStatus(puzzle) === 'done');
  const thisYear = String(now.getFullYear());

  const byYear = new Map<string, number>();
  for (const puzzle of done) {
    const year = puzzle.completedAt?.slice(0, 4);
    if (year) byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }
  const years = [...byYear.keys()].map(Number);
  const perYear: YearCount[] = [];
  if (years.length) {
    // Fill gaps, so a year with no puzzles shows as zero rather than disappearing.
    for (let year = Math.min(...years); year <= Math.max(...years); year++) {
      perYear.push({ year: String(year), count: byYear.get(String(year)) ?? 0 });
    }
  }

  const brands = new Map<string, RankedCount>();
  for (const puzzle of done) {
    if (!puzzle.brand) continue;
    const key = puzzle.brand.toLocaleLowerCase();
    const entry = brands.get(key) ?? { name: puzzle.brand, count: 0 };
    entry.count++;
    brands.set(key, entry);
  }

  const timed = done
    .map((puzzle) => ({ pieces: puzzle.pieceCount ?? 0, ms: totalTimeMs(puzzle, now.getTime()) }))
    .filter(({ pieces, ms }) => pieces > 0 && ms > 0);

  return {
    statusCounts,
    timeSpentMs: puzzles.reduce((sum, puzzle) => sum + totalTimeMs(puzzle, now.getTime()), 0),
    piecesPerHour: piecesPerHour(
      timed.reduce((sum, { pieces }) => sum + pieces, 0),
      timed.reduce((sum, { ms }) => sum + ms, 0),
    ),
    piecesPlaced: done.reduce((sum, puzzle) => sum + (puzzle.pieceCount ?? 0), 0),
    doneThisYear: byYear.get(thisYear) ?? 0,
    perYear,
    undated: done.filter((puzzle) => !puzzle.completedAt).length,
    topBrands: [...brands.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, top),
    topTags: tagCounts(done)
      .slice(0, top)
      .map(({ tag, count }) => ({ name: tag, count })),
  };
}

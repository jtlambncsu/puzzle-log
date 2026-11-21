import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { puzzleStats } from './stats';

let id = 0;
function puzzle(fields: Partial<Puzzle> = {}): Puzzle {
  return { id: String(++id), userId: 'u', createdAt: '', title: 'x', ...fields };
}

describe('puzzleStats', () => {
  const stats = puzzleStats(
    [
      puzzle({ completedAt: '2024-03-01', pieceCount: 1000, brand: 'Ravensburger', tags: ['Art'] }),
      puzzle({ completedAt: '2026-01-02', pieceCount: 500, brand: 'ravensburger', tags: ['art'] }),
      puzzle({ completedAt: '2026-06-02', brand: 'Ceaco' }),
      puzzle({ pieceCount: 300 }), // done, no date
      puzzle({ status: 'owned', pieceCount: 2000, brand: 'Buffalo', completedAt: '2026-01-01' }),
      puzzle({ status: 'wishlist' }),
    ],
    new Date('2026-11-21T12:00:00'),
  );

  it('counts statuses, treating missing as done', () => {
    expect(stats.statusCounts).toEqual({ done: 4, owned: 1, wishlist: 1 });
  });

  it('only counts finished puzzles for pieces, years, brands and tags', () => {
    expect(stats.piecesPlaced).toBe(1800);
    expect(stats.doneThisYear).toBe(2);
    expect(stats.topBrands).toEqual([
      { name: 'Ravensburger', count: 2 },
      { name: 'Ceaco', count: 1 },
    ]);
    expect(stats.topTags).toEqual([{ name: 'Art', count: 2 }]);
  });

  it('fills years with no puzzles, and counts undated ones separately', () => {
    expect(stats.perYear).toEqual([
      { year: '2024', count: 1 },
      { year: '2025', count: 0 },
      { year: '2026', count: 2 },
    ]);
    expect(stats.undated).toBe(1);
  });

  it('handles an empty log', () => {
    expect(puzzleStats([]).perYear).toEqual([]);
  });
});

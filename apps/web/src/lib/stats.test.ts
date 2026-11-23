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
    expect(stats.statusCounts).toEqual({ done: 4, in_progress: 0, owned: 1, wishlist: 1 });
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

  it('lists favorites, averages ratings, and works out pace by difficulty', () => {
    const hour = 3_600_000;
    const session = (hours: number) => [
      {
        start: '2026-01-01T00:00:00Z',
        end: new Date(Date.parse('2026-01-01T00:00:00Z') + hours * hour).toISOString(),
      },
    ];
    const stats = puzzleStats([
      {
        id: 'a',
        userId: 'u',
        createdAt: '1',
        title: 'Loved',
        rating: 5,
        completedAt: '2026-01-01',
      },
      {
        id: 'b',
        userId: 'u',
        createdAt: '2',
        title: 'Liked',
        rating: 4,
        difficulty: 'easy',
        pieceCount: 500,
        sessions: session(2),
      },
      {
        id: 'c',
        userId: 'u',
        createdAt: '3',
        title: 'Meh',
        rating: 2,
        difficulty: 'easy',
        pieceCount: 1000,
        sessions: session(2),
      },
      {
        id: 'd',
        userId: 'u',
        createdAt: '4',
        title: 'Hard one',
        difficulty: 'hard',
        pieceCount: 1000,
        sessions: session(10),
      },
      { id: 'e', userId: 'u', createdAt: '5', title: 'Not done', status: 'owned', rating: 5 },
    ]);
    expect(stats.favorites.map((p) => p.title)).toEqual(['Loved', 'Liked']);
    expect(stats.averageRating).toBeCloseTo(11 / 3);
    expect(stats.paceByDifficulty).toEqual([
      { difficulty: 'easy', puzzles: 2, piecesPerHour: 375 },
      { difficulty: 'hard', puzzles: 1, piecesPerHour: 100 },
    ]);
  });
});

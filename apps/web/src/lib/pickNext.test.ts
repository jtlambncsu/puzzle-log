import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { pickCandidates, pickNext } from './pickNext';

const puzzle = (id: string, extra: Partial<Puzzle> = {}): Puzzle => ({
  id,
  userId: 'u',
  title: id,
  createdAt: '2026-01-01',
  status: 'owned',
  ...extra,
});

describe('pickCandidates', () => {
  const puzzles = [
    puzzle('small', { pieceCount: 500, tags: ['Disney'] }),
    puzzle('big', { pieceCount: 2000, tags: ['Disney'] }),
    puzzle('unknown size'),
    puzzle('done', { status: 'done', pieceCount: 500 }),
    puzzle('started', { status: 'in_progress' }),
    puzzle('wanted', { status: 'wishlist' }),
  ];

  it('only offers owned puzzles not started yet', () => {
    expect(pickCandidates(puzzles, {}).map((p) => p.id)).toEqual(['small', 'big', 'unknown size']);
  });

  it('filters by size (keeping unknown sizes) and by tag', () => {
    expect(pickCandidates(puzzles, { maxPieces: 1000 }).map((p) => p.id)).toEqual([
      'small',
      'unknown size',
    ]);
    expect(pickCandidates(puzzles, { tag: 'disney', maxPieces: 1000 }).map((p) => p.id)).toEqual([
      'small',
    ]);
  });
});

describe('pickNext', () => {
  const pile = [puzzle('a'), puzzle('b'), puzzle('c')];

  it('picks at random', () => {
    expect(pickNext(pile, undefined, () => 0)?.id).toBe('a');
    expect(pickNext(pile, undefined, () => 0.99)?.id).toBe('c');
  });

  it('never repeats the one just shown, unless it is the only one', () => {
    for (const r of [0, 0.5, 0.99]) expect(pickNext(pile, 'a', () => r)?.id).not.toBe('a');
    expect(pickNext([puzzle('only')], 'only', () => 0)?.id).toBe('only');
    expect(pickNext([], undefined)).toBeUndefined();
  });
});

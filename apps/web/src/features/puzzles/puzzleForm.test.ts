import { describe, expect, it } from 'vitest';
import { emptyPuzzleForm, puzzleFormSchema, toCreatePuzzleInput } from './puzzleForm';

describe('puzzle form', () => {
  it('turns form strings into API input, dropping blanks', () => {
    expect(
      toCreatePuzzleInput({ ...emptyPuzzleForm, title: ' Starry Night ', pieceCount: '1000' }),
    ).toEqual({ title: 'Starry Night', status: 'done', pieceCount: 1000 });
  });

  it('only keeps a finished date for finished puzzles', () => {
    const values = { ...emptyPuzzleForm, title: 'x', completedAt: '2026-11-21' };
    expect(toCreatePuzzleInput({ ...values, status: 'done' }).completedAt).toBe('2026-11-21');
    expect(toCreatePuzzleInput({ ...values, status: 'wishlist' }).completedAt).toBeUndefined();
  });

  it.each(['0', '-5', '12.5', 'abc', '1000000'])('rejects %s pieces', (pieceCount) => {
    expect(puzzleFormSchema.safeParse({ ...emptyPuzzleForm, title: 'x', pieceCount }).success).toBe(
      false,
    );
  });
});

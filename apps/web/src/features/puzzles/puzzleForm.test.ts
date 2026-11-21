import { describe, expect, it } from 'vitest';
import { emptyPuzzleForm, puzzleFormSchema, toCreatePuzzleInput } from './puzzleForm';

describe('puzzle form', () => {
  it('turns form strings into API input, dropping blanks', () => {
    expect(
      toCreatePuzzleInput({ ...emptyPuzzleForm, title: ' Starry Night ', pieceCount: '1000' }),
    ).toEqual({ title: 'Starry Night', pieceCount: 1000 });
  });

  it.each(['0', '-5', '12.5', 'abc', '1000000'])('rejects %s pieces', (pieceCount) => {
    expect(puzzleFormSchema.safeParse({ ...emptyPuzzleForm, title: 'x', pieceCount }).success).toBe(
      false,
    );
  });
});

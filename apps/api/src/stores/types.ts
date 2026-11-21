import type { CreatePuzzleInput, Puzzle, UpdatePuzzleInput } from '@puzzle-log/shared';

/**
 * Storage abstraction so routes don't care whether data lives in memory or DynamoDB.
 * Every call is scoped to one user, so a user can never read or change another's puzzles.
 */
export interface PuzzleStore {
  list(userId: string): Promise<Puzzle[]>;
  get(userId: string, id: string): Promise<Puzzle | undefined>;
  create(userId: string, input: CreatePuzzleInput): Promise<Puzzle>;
  /** Applies `patch` and returns the updated puzzle, or `undefined` if it doesn't exist. */
  update(userId: string, id: string, patch: UpdatePuzzleInput): Promise<Puzzle | undefined>;
  /** Returns the deleted puzzle (so its photo can be cleaned up), or `undefined`. */
  delete(userId: string, id: string): Promise<Puzzle | undefined>;
}

export function newPuzzle(userId: string, input: CreatePuzzleInput, id: string): Puzzle {
  return { ...input, id, userId, createdAt: new Date().toISOString() };
}

export function newestFirst(a: Puzzle, b: Puzzle) {
  return b.createdAt.localeCompare(a.createdAt);
}

import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

/** Storage abstraction so routes don't care whether data lives in memory or DynamoDB. */
export interface PuzzleStore {
  list(): Promise<Puzzle[]>;
  get(id: string): Promise<Puzzle | undefined>;
  create(input: CreatePuzzleInput): Promise<Puzzle>;
  delete(id: string): Promise<boolean>;
}

export function newPuzzle(input: CreatePuzzleInput, id: string): Puzzle {
  return { ...input, id, createdAt: new Date().toISOString() };
}

export function newestFirst(a: Puzzle, b: Puzzle) {
  return b.createdAt.localeCompare(a.createdAt);
}

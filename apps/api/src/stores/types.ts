import type {
  CreatePuzzleInput,
  Puzzle,
  PuzzleDetails,
  UpdatePuzzleInput,
} from '@puzzle-log/shared';

/**
 * Storage abstraction so routes don't care whether data lives in memory or DynamoDB.
 * Every call is scoped to one user, so a user can never read or change another's puzzles.
 */
export interface PuzzleStore {
  list(userId: string): Promise<Puzzle[]>;
  get(userId: string, id: string): Promise<Puzzle | undefined>;
  create(userId: string, input: CreatePuzzleInput): Promise<Puzzle>;
  /**
   * Applies `patch` and returns the updated puzzle, or `undefined` if it doesn't exist.
   * With `expect`, the write only happens if the timer is still as the caller last saw it
   * (`null` meaning not running); otherwise it throws a `ConflictError` and changes nothing.
   */
  update(
    userId: string,
    id: string,
    patch: PuzzlePatch,
    expect?: TimerExpectation,
  ): Promise<Puzzle | undefined>;
  /** Returns the deleted puzzle (so its photo can be cleaned up), or `undefined`. */
  delete(userId: string, id: string): Promise<Puzzle | undefined>;
}

/** A client's update plus the field only the API itself may change. */
export type PuzzlePatch = Omit<UpdatePuzzleInput, 'details'> & {
  timerStartedAt?: string | null;
  details?: PuzzleDetails | null;
  detailsSearchedAt?: string;
};

export interface TimerExpectation {
  timerStartedAt: string | null;
}

/** A conditional update found the puzzle changed since it was read. */
export class ConflictError extends Error {
  constructor() {
    super('The puzzle changed while it was being updated');
  }
}

export function newPuzzle(userId: string, input: CreatePuzzleInput, id: string): Puzzle {
  return { ...input, id, userId, createdAt: new Date().toISOString() };
}

export function newestFirst(a: Puzzle, b: Puzzle) {
  return b.createdAt.localeCompare(a.createdAt);
}

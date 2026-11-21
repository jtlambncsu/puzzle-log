import { randomUUID } from 'node:crypto';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

/**
 * Storage abstraction so the in-memory version can later be swapped for
 * DynamoDB / Postgres without touching the routes.
 */
export interface PuzzleStore {
  list(): Promise<Puzzle[]>;
  get(id: string): Promise<Puzzle | undefined>;
  create(input: CreatePuzzleInput): Promise<Puzzle>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryPuzzleStore implements PuzzleStore {
  private puzzles = new Map<string, Puzzle>();

  async list() {
    return [...this.puzzles.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string) {
    return this.puzzles.get(id);
  }

  async create(input: CreatePuzzleInput) {
    const puzzle: Puzzle = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.puzzles.set(puzzle.id, puzzle);
    return puzzle;
  }

  async delete(id: string) {
    return this.puzzles.delete(id);
  }
}

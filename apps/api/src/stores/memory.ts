import { randomUUID } from 'node:crypto';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import { newestFirst, newPuzzle, type PuzzleStore } from './types.js';

/** Used for local development and tests. Data resets on restart. */
export class InMemoryPuzzleStore implements PuzzleStore {
  private puzzles = new Map<string, Puzzle>();

  async list(userId: string) {
    return [...this.puzzles.values()].filter((p) => p.userId === userId).sort(newestFirst);
  }

  async get(userId: string, id: string) {
    const puzzle = this.puzzles.get(id);
    return puzzle?.userId === userId ? puzzle : undefined;
  }

  async create(userId: string, input: CreatePuzzleInput) {
    const puzzle = newPuzzle(userId, input, randomUUID());
    this.puzzles.set(puzzle.id, puzzle);
    return puzzle;
  }

  async delete(userId: string, id: string) {
    if (!(await this.get(userId, id))) return false;
    return this.puzzles.delete(id);
  }
}

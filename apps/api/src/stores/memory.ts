import { randomUUID } from 'node:crypto';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import { newestFirst, newPuzzle, type PuzzleStore } from './types.js';

/** Used for local development and tests. Data resets on restart. */
export class InMemoryPuzzleStore implements PuzzleStore {
  private puzzles = new Map<string, Puzzle>();

  async list() {
    return [...this.puzzles.values()].sort(newestFirst);
  }

  async get(id: string) {
    return this.puzzles.get(id);
  }

  async create(input: CreatePuzzleInput) {
    const puzzle = newPuzzle(input, randomUUID());
    this.puzzles.set(puzzle.id, puzzle);
    return puzzle;
  }

  async delete(id: string) {
    return this.puzzles.delete(id);
  }
}

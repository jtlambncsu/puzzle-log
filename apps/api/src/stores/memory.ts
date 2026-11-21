import { randomUUID } from 'node:crypto';
import type { CreatePuzzleInput, Puzzle, UpdatePuzzleInput } from '@puzzle-log/shared';
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

  async update(userId: string, id: string, patch: UpdatePuzzleInput) {
    const existing = await this.get(userId, id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.puzzles.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string) {
    const existing = await this.get(userId, id);
    if (existing) this.puzzles.delete(id);
    return existing;
  }
}

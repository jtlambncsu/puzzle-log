import { randomUUID } from 'node:crypto';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import {
  ConflictError,
  newestFirst,
  newPuzzle,
  type PuzzlePatch,
  type PuzzleStore,
  type TimerExpectation,
} from './types.js';

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

  async update(userId: string, id: string, patch: PuzzlePatch, expect?: TimerExpectation) {
    const existing = await this.get(userId, id);
    if (!existing) return undefined;
    if (expect && (existing.timerStartedAt ?? null) !== expect.timerStartedAt) {
      throw new ConflictError();
    }
    const updated: Puzzle = { ...existing };
    for (const [name, value] of Object.entries(patch)) {
      // JSON Merge Patch: null removes the field.
      if (value === null) delete updated[name as keyof Puzzle];
      else if (value !== undefined) Object.assign(updated, { [name]: value });
    }
    this.puzzles.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string) {
    const existing = await this.get(userId, id);
    if (existing) this.puzzles.delete(id);
    return existing;
  }
}

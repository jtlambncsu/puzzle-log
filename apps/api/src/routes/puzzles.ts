import { Router } from 'express';
import { createPuzzleSchema, type Puzzle } from '@puzzle-log/shared';
import type { PuzzleStore } from '../stores/types.js';
import { photoKeyPrefix, type PhotoStorage } from '../photos/types.js';

export function puzzlesRouter(store: PuzzleStore, photos?: PhotoStorage) {
  const router = Router();

  /** Adds a temporary viewing URL for the puzzle's photo, if it has one. */
  async function withImageUrl(puzzle: Puzzle): Promise<Puzzle> {
    if (!photos || !puzzle.imageKey) return puzzle;
    return { ...puzzle, imageUrl: await photos.getViewUrl(puzzle.imageKey) };
  }

  router.get('/', async (_req, res) => {
    const puzzles = await store.list(res.locals.userId);
    res.json(await Promise.all(puzzles.map(withImageUrl)));
  });

  router.get('/:id', async (req, res) => {
    const puzzle = await store.get(res.locals.userId, req.params.id);
    if (!puzzle) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    res.json(await withImageUrl(puzzle));
  });

  router.post('/', async (req, res) => {
    const { userId } = res.locals;
    const result = createPuzzleSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid puzzle', issues: result.error.issues });
      return;
    }
    // Without this check, a user could attach (and get a viewing link for) someone
    // else's photo by guessing its key.
    if (result.data.imageKey && !result.data.imageKey.startsWith(photoKeyPrefix(userId))) {
      res.status(400).json({ error: 'Invalid image key' });
      return;
    }
    res.status(201).json(await withImageUrl(await store.create(userId, result.data)));
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await store.delete(res.locals.userId, req.params.id);
    res.status(deleted ? 204 : 404).end();
  });

  return router;
}

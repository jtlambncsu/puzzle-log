import { Router } from 'express';
import { createPuzzleSchema } from '@puzzle-log/shared';
import type { PuzzleStore } from '../store.js';

export function puzzlesRouter(store: PuzzleStore) {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await store.list());
  });

  router.get('/:id', async (req, res) => {
    const puzzle = await store.get(req.params.id);
    if (!puzzle) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    res.json(puzzle);
  });

  router.post('/', async (req, res) => {
    const result = createPuzzleSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid puzzle', issues: result.error.issues });
      return;
    }
    res.status(201).json(await store.create(result.data));
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await store.delete(req.params.id);
    res.status(deleted ? 204 : 404).end();
  });

  return router;
}

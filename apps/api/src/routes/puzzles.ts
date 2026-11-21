import { Router } from 'express';
import { createPuzzleSchema, updatePuzzleSchema, type Puzzle } from '@puzzle-log/shared';
import type { PuzzleStore } from '../stores/types.js';
import { photoKeyPrefix, type PhotoStorage } from '../photos/types.js';

export function puzzlesRouter(store: PuzzleStore, photos?: PhotoStorage) {
  const router = Router();

  /** Users may only attach photos from their own upload folder. */
  function ownsImageKey(userId: string, imageKey?: string) {
    return !imageKey || imageKey.startsWith(photoKeyPrefix(userId));
  }

  /**
   * Removes a photo that no puzzle uses any more. Best-effort: a leftover file is harmless,
   * a failed request isn't, so errors are logged rather than returned.
   */
  async function deletePhoto(key?: string) {
    if (!photos || !key) return;
    try {
      await photos.delete(key);
    } catch (error) {
      console.error(`Could not delete photo ${key}`, error);
    }
  }

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
    if (!ownsImageKey(userId, result.data.imageKey)) {
      res.status(400).json({ error: 'Invalid image key' });
      return;
    }
    res.status(201).json(await withImageUrl(await store.create(userId, result.data)));
  });

  router.patch('/:id', async (req, res) => {
    const { userId } = res.locals;
    const result = updatePuzzleSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid update', issues: result.error.issues });
      return;
    }
    if (!ownsImageKey(userId, result.data.imageKey)) {
      res.status(400).json({ error: 'Invalid image key' });
      return;
    }
    const before = await store.get(userId, req.params.id);
    const updated = before && (await store.update(userId, req.params.id, result.data));
    if (!updated) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    // A replaced photo (e.g. after rotating it) is no longer used.
    if (before.imageKey && before.imageKey !== updated.imageKey) {
      await deletePhoto(before.imageKey);
    }
    res.json(await withImageUrl(updated));
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await store.delete(res.locals.userId, req.params.id);
    if (!deleted) {
      res.status(404).end();
      return;
    }
    await deletePhoto(deleted.imageKey);
    res.status(204).end();
  });

  return router;
}

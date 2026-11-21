import { Router } from 'express';
import {
  createPuzzleSchema,
  startTimerSchema,
  updatePuzzleSchema,
  type Puzzle,
} from '@puzzle-log/shared';
import { ConflictError, type PuzzlePatch, type PuzzleStore } from '../stores/types.js';
import { photoKeyPrefix, type PhotoStorage } from '../photos/types.js';
import { isTimerRunning, startTimerPatch, stopTimerPatch } from '../timer.js';

export function puzzlesRouter(store: PuzzleStore, photos?: PhotoStorage, clock = () => new Date()) {
  const router = Router();

  /**
   * Starts or stops the timer, but only if it's still as `puzzle` shows. If another tap or
   * device got there first, the timer is already where the user wanted it, so the latest
   * puzzle is returned instead of an error: pressing Start (or Pause) twice is harmless.
   */
  async function changeTimer(userId: string, puzzle: Puzzle, patch: PuzzlePatch) {
    try {
      return await store.update(userId, puzzle.id, patch, {
        timerStartedAt: puzzle.timerStartedAt ?? null,
      });
    } catch (error) {
      if (error instanceof ConflictError) return store.get(userId, puzzle.id);
      throw error;
    }
  }

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
    if (!before) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    let patch: PuzzlePatch = result.data;
    // A timer only runs on an in-progress puzzle, so moving it elsewhere (e.g. marking it
    // done) also stops the timer and saves the session.
    const stopsTimer =
      isTimerRunning(before) && patch.status !== undefined && patch.status !== 'in_progress';
    if (stopsTimer) {
      patch = { ...patch, ...stopTimerPatch(before, clock(), patch.sessions ?? before.sessions) };
    }
    let updated: Puzzle | undefined;
    try {
      updated = await store.update(
        userId,
        before.id,
        patch,
        stopsTimer ? { timerStartedAt: before.timerStartedAt } : undefined,
      );
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      res.status(409).json({ error: 'The timer changed. Reload and try again.' });
      return;
    }
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

  router.post('/:id/timer/start', async (req, res) => {
    const { userId } = res.locals;
    const result = startTimerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', issues: result.error.issues });
      return;
    }
    const puzzle = await store.get(userId, req.params.id);
    const updated =
      puzzle &&
      (isTimerRunning(puzzle)
        ? puzzle
        : await changeTimer(userId, puzzle, startTimerPatch(puzzle, clock(), result.data.today)));
    if (!updated) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    res.json(await withImageUrl(updated));
  });

  router.post('/:id/timer/stop', async (req, res) => {
    const { userId } = res.locals;
    const puzzle = await store.get(userId, req.params.id);
    const updated =
      puzzle &&
      (isTimerRunning(puzzle)
        ? await changeTimer(userId, puzzle, stopTimerPatch(puzzle, clock()))
        : puzzle);
    if (!updated) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
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

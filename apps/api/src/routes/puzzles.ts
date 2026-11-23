import { Router } from 'express';
import {
  createPuzzleSchema,
  MAX_TAGS,
  startTimerSchema,
  uniqueTags,
  updatePuzzleSchema,
  type Puzzle,
} from '@puzzle-log/shared';
import { ConflictError, type PuzzlePatch, type PuzzleStore } from '../stores/types.js';
import { photoKeyPrefix, type PhotoStorage } from '../photos/types.js';
import { SuggestionUnavailableError, type PuzzleSuggester } from '../suggestions/types.js';
import { isTimerRunning, startTimerPatch, stopTimerPatch } from '../timer.js';

export function puzzlesRouter(
  store: PuzzleStore,
  photos?: PhotoStorage,
  clock = () => new Date(),
  suggester?: PuzzleSuggester,
) {
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

  /** Adds temporary viewing URLs for the puzzle's photos (finished and box), if any. */
  async function withImageUrl(puzzle: Puzzle): Promise<Puzzle> {
    if (!photos || !(puzzle.imageKey || puzzle.boxImageKey)) return puzzle;
    const [imageUrl, boxImageUrl] = await Promise.all([
      puzzle.imageKey && photos.getViewUrl(puzzle.imageKey),
      puzzle.boxImageKey && photos.getViewUrl(puzzle.boxImageKey),
    ]);
    return {
      ...puzzle,
      ...(imageUrl && { imageUrl }),
      ...(boxImageUrl && { boxImageUrl }),
    };
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
    if (
      !ownsImageKey(userId, result.data.imageKey) ||
      !ownsImageKey(userId, result.data.boxImageKey)
    ) {
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
    if (
      !ownsImageKey(userId, result.data.imageKey) ||
      !ownsImageKey(userId, result.data.boxImageKey ?? undefined)
    ) {
      res.status(400).json({ error: 'Invalid image key' });
      return;
    }
    const before = await store.get(userId, req.params.id);
    if (!before) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    let patch: PuzzlePatch = result.data;
    // A new photo (e.g. rotated) no longer matches the old one's fingerprint. Dropping it
    // lets the web app compute a fresh one, rather than keep a stale one.
    if (patch.imageKey && patch.imageKey !== before.imageKey && !patch.photoFingerprint) {
      patch = { ...patch, photoFingerprint: null };
    }
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
    // A replaced or removed photo (e.g. after rotating it) is no longer used.
    if (before.imageKey && before.imageKey !== updated.imageKey) {
      await deletePhoto(before.imageKey);
    }
    if (before.boxImageKey && before.boxImageKey !== updated.boxImageKey) {
      await deletePhoto(before.boxImageKey);
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

  /**
   * Names an imported puzzle from its photo: title, brand and tags, added to the puzzle for
   * the user to check on the review screen. Only for puzzles still waiting for review, so
   * it can never overwrite what the user wrote.
   */
  router.post('/:id/suggest', async (req, res) => {
    const { userId } = res.locals;
    if (!suggester || !photos) {
      res.status(501).json({ error: "Suggestions aren't set up on this server" });
      return;
    }
    const puzzles = await store.list(userId);
    const puzzle = puzzles.find((p) => p.id === req.params.id);
    if (!puzzle) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    if (!puzzle.needsReview || !puzzle.imageKey) {
      res.status(409).json({ error: 'Only imported puzzles waiting for review get suggestions' });
      return;
    }

    let suggestion;
    try {
      const knownTags = uniqueTags(puzzles.flatMap((p) => (p.needsReview ? [] : (p.tags ?? []))));
      suggestion = await suggester.suggest(await photos.getViewUrl(puzzle.imageKey), knownTags);
    } catch (error) {
      if (!(error instanceof SuggestionUnavailableError)) throw error;
      console.error('Suggestion failed', error);
      res.status(503).json({ error: 'Suggestions are unavailable right now' });
      return;
    }

    const updated = await store.update(userId, puzzle.id, {
      title: suggestion.title,
      ...(suggestion.brand && { brand: suggestion.brand }),
      tags: uniqueTags([...(puzzle.tags ?? []), ...suggestion.tags]).slice(0, MAX_TAGS),
    });
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
    await Promise.all([deletePhoto(deleted.imageKey), deletePhoto(deleted.boxImageKey)]);
    res.status(204).end();
  });

  return router;
}

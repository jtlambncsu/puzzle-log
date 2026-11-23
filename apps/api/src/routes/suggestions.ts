import { Router } from 'express';
import { suggestTagsSchema, uniqueTags, type SuggestTagsResult } from '@puzzle-log/shared';
import { photoKeyPrefix, type PhotoStorage } from '../photos/types.js';
import type { PuzzleStore } from '../stores/types.js';
import { SuggestionUnavailableError, type PuzzleSuggester } from '../suggestions/types.js';

/**
 * `POST /api/suggestions/tags`: AI tag ideas for a puzzle being added or edited. Nothing is
 * saved; the form shows the tags and the user keeps the ones they want.
 */
export function suggestionsRouter(
  store: PuzzleStore,
  photos?: PhotoStorage,
  suggester?: PuzzleSuggester,
) {
  const router = Router();

  router.post('/tags', async (req, res) => {
    const { userId } = res.locals;
    if (!suggester) {
      res.status(501).json({ error: "Suggestions aren't set up on this server" });
      return;
    }
    const result = suggestTagsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', issues: result.error.issues });
      return;
    }
    const { title, brand, imageKeys } = result.data;
    // Only the user's own photos: otherwise this would show someone else's photo to the AI.
    if (imageKeys.some((key) => !key.startsWith(photoKeyPrefix(userId)))) {
      res.status(400).json({ error: 'Invalid image key' });
      return;
    }

    try {
      const knownTags = uniqueTags((await store.list(userId)).flatMap((p) => p.tags ?? []));
      const imageUrls = photos ? await Promise.all(imageKeys.map((k) => photos.getViewUrl(k))) : [];
      const tags = await suggester.suggestTags({ title, brand, imageUrls }, knownTags);
      res.json({ tags } satisfies SuggestTagsResult);
    } catch (error) {
      if (!(error instanceof SuggestionUnavailableError)) throw error;
      console.error('Tag suggestion failed', error);
      res.status(503).json({ error: 'Suggestions are unavailable right now' });
    }
  });

  return router;
}

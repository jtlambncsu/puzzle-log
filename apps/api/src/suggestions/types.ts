import type { PuzzleSuggestion } from '@puzzle-log/shared';

/** Suggests a title, brand and tags for a finished puzzle from its photo. */
export interface PuzzleSuggester {
  /**
   * @param imageUrl A URL the suggester can fetch the photo from.
   * @param knownTags The user's existing tags, so suggestions reuse their spelling.
   */
  suggest(imageUrl: string, knownTags: readonly string[]): Promise<PuzzleSuggestion>;
}

/** The suggester couldn't answer (no API key, a timeout, a refusal...). Try again later. */
export class SuggestionUnavailableError extends Error {}

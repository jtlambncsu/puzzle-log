import type { BoxDetails, PuzzleSuggestion } from '@puzzle-log/shared';

/** Suggests a title, brand and tags for a finished puzzle from its photo. */
export interface PuzzleSuggester {
  /**
   * @param imageUrl A URL the suggester can fetch the photo from.
   * @param knownTags The user's existing tags, so suggestions reuse their spelling.
   */
  suggest(imageUrl: string, knownTags: readonly string[]): Promise<PuzzleSuggestion>;

  /**
   * Tag ideas for one puzzle, from whatever is known: its title, brand, and photos (the
   * finished puzzle and/or its box).
   */
  suggestTags(input: TagSuggestionInput, knownTags: readonly string[]): Promise<string[]>;

  /**
   * Reads the title, brand and piece count printed on a puzzle box.
   * @param imageUrl A URL the suggester can fetch the box photo from.
   */
  readBox(imageUrl: string): Promise<BoxDetails>;
}

export interface TagSuggestionInput {
  title?: string;
  brand?: string;
  /** URLs the suggester can fetch the photos from. */
  imageUrls: string[];
}

/** The suggester couldn't answer (no API key, a timeout, a refusal...). Try again later. */
export class SuggestionUnavailableError extends Error {}

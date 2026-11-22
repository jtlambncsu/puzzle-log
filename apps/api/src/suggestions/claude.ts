import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { MAX_TAGS, tagSchema, uniqueTags, type PuzzleSuggestion } from '@puzzle-log/shared';
import type { AnthropicClientProvider } from '../anthropic.js';
import { SuggestionUnavailableError, type PuzzleSuggester } from './types.js';

/**
 * Sonnet: naming a puzzle from a photo doesn't need the most capable model, and Sonnet costs
 * about half as much as Opus (under 1 cent a photo) for nearly the same recognition.
 */
const MODEL = 'claude-sonnet-5-5';

const SYSTEM_PROMPT = `You help someone catalog the jigsaw puzzles they have finished. You get a photo of one completed puzzle, usually without its box, and suggest how to file it.

- title: the product's name if you recognize this specific puzzle, or the artwork's name if it's a known painting or illustration (for example "The Starry Night"). Otherwise a short descriptive title of the picture, such as "Lighthouse at Sunset". Title Case, under 60 characters.
- brand: the puzzle maker, only if a logo or name is visible in the photo or you recognize the exact product. Otherwise null.
- tags: 1 to 5 short tags that would help them search their collection later: franchises (Star Wars, Disney), subjects (Cats, Lighthouses), styles or settings (Landscape, Christmas). When one of their existing tags fits, use it with exactly the same spelling.

If the photo doesn't show a jigsaw puzzle, describe what it shows in the same format.`;

const suggestionSchema = z.object({
  title: z.string(),
  brand: z.string().nullable(),
  tags: z.array(z.string()),
});

/**
 * Asks Claude (vision + structured outputs) to name a puzzle from its photo. The photo is
 * passed as a short-lived S3 URL, which Anthropic fetches; the image never goes through
 * this Lambda.
 */
export class ClaudeSuggester implements PuzzleSuggester {
  constructor(private readonly anthropic: AnthropicClientProvider) {}

  async suggest(imageUrl: string, knownTags: readonly string[]): Promise<PuzzleSuggestion> {
    let response;
    try {
      const client = await this.anthropic.get();
      response = await client.beta.messages.parse({
        model: MODEL,
        // A suggestion is a few dozen tokens. This cap bounds the worst case (about 4 cents
        // on Sonnet) if a response ever ran long.
        max_tokens: 4000,
        // A quick look is enough here: identifying a picture isn't a hard reasoning task.
        output_config: { effort: 'low', format: betaZodOutputFormat(suggestionSchema) },
        // If the model declines, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              {
                type: 'text',
                text: knownTags.length
                  ? `Their existing tags: ${knownTags.join(', ')}`
                  : 'They have no tags yet.',
              },
            ],
          },
        ],
      });
    } catch (error) {
      this.anthropic.noteError(error);
      throw new SuggestionUnavailableError('The suggestion service is unavailable', {
        cause: error,
      });
    }

    const output = response.parsed_output;
    if (response.stop_reason === 'refusal' || !output) {
      throw new SuggestionUnavailableError(`No suggestion (stop reason: ${response.stop_reason})`);
    }
    return cleanSuggestion(output);
  }
}

/** Keeps only values our own schema accepts, so a suggestion can always be saved. */
export function cleanSuggestion(output: z.infer<typeof suggestionSchema>): PuzzleSuggestion {
  const tags = output.tags.flatMap((tag) => {
    const result = tagSchema.safeParse(tag);
    return result.success ? [result.data] : [];
  });
  const brand = output.brand?.trim().slice(0, 100);
  return {
    title: output.title.trim().slice(0, 200) || 'Untitled puzzle',
    ...(brand && { brand }),
    tags: uniqueTags(tags).slice(0, MAX_TAGS),
  };
}

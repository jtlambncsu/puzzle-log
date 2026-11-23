import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { z } from 'zod';
import { MAX_TAGS, tagSchema, uniqueTags, type PuzzleSuggestion } from '@puzzle-log/shared';
import {
  SuggestionUnavailableError,
  type PuzzleSuggester,
  type TagSuggestionInput,
} from './types.js';

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

const TAGS_PROMPT = `You suggest tags for one jigsaw puzzle in someone's collection, so they can find it again by searching. You may get a photo of the finished puzzle, a photo of its box, its title and its brand.

Suggest 2 to 5 short tags: franchises or licences (Star Wars, Disney), the artist if known (Thomas Kinkade), subjects (Cats, Lighthouses), styles, seasons or settings (Landscape, Christmas). When one of their existing tags fits, use it with exactly the same spelling. Don't repeat the brand or the piece count, and don't tag something you can't see or tell from the title.`;

const tagsSchema = z.object({ tags: z.array(z.string()) });

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
  private client?: Promise<Anthropic>;

  /**
   * @param getApiKey Loads the key on first use (e.g. from SSM), so a cold start stays fast.
   * @param clientOptions Extra SDK options (tests pass a fake `fetch`).
   */
  constructor(
    private readonly getApiKey: () => Promise<string>,
    private readonly clientOptions: ClientOptions = {},
  ) {}

  private getClient() {
    this.client ??= this.getApiKey().then(
      // API Gateway gives up after 30 seconds, so one 25-second try, no retries.
      (apiKey) => new Anthropic({ timeout: 25_000, maxRetries: 0, ...this.clientOptions, apiKey }),
    );
    // Don't cache a failure (e.g. the key wasn't set up yet): try again next time.
    this.client.catch(() => (this.client = undefined));
    return this.client;
  }

  async suggest(imageUrl: string, knownTags: readonly string[]): Promise<PuzzleSuggestion> {
    let response;
    try {
      const client = await this.getClient();
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
      // A rejected key may have been replaced since it was loaded: load it again next time,
      // instead of failing until AWS happens to start a fresh Lambda instance.
      if (error instanceof Anthropic.AuthenticationError) this.client = undefined;
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

  async suggestTags(input: TagSuggestionInput, knownTags: readonly string[]): Promise<string[]> {
    const details = [
      input.title && `Title: ${input.title}`,
      input.brand && `Brand: ${input.brand}`,
      knownTags.length ? `Their existing tags: ${knownTags.join(', ')}` : 'They have no tags yet.',
    ].filter(Boolean);
    let response;
    try {
      const client = await this.getClient();
      response = await client.beta.messages.parse({
        model: MODEL,
        // A handful of tags is a few dozen tokens; this caps the worst case at about 4 cents.
        max_tokens: 4000,
        output_config: { effort: 'low', format: betaZodOutputFormat(tagsSchema) },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: TAGS_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...input.imageUrls.map((url) => ({
                type: 'image' as const,
                source: { type: 'url' as const, url },
              })),
              { type: 'text', text: details.join('\n') },
            ],
          },
        ],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) this.client = undefined;
      throw new SuggestionUnavailableError('The suggestion service is unavailable', {
        cause: error,
      });
    }
    const output = response.parsed_output;
    if (response.stop_reason === 'refusal' || !output) {
      throw new SuggestionUnavailableError(`No tags (stop reason: ${response.stop_reason})`);
    }
    return cleanTags(output.tags).slice(0, 5);
  }
}

function cleanTags(tags: readonly string[]) {
  return uniqueTags(
    tags.flatMap((tag) => {
      const result = tagSchema.safeParse(tag);
      return result.success ? [result.data] : [];
    }),
  );
}

/** Keeps only values our own schema accepts, so a suggestion can always be saved. */
export function cleanSuggestion(output: z.infer<typeof suggestionSchema>): PuzzleSuggestion {
  const brand = output.brand?.trim().slice(0, 100);
  return {
    title: output.title.trim().slice(0, 200) || 'Untitled puzzle',
    ...(brand && { brand }),
    tags: cleanTags(output.tags).slice(0, MAX_TAGS),
  };
}

/** Reads the API key from an SSM SecureString parameter (set up once in the AWS console). */
export function apiKeyFromSsm(parameterName: string, ssm = new SSMClient({})) {
  return async () => {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    );
    // Trimmed: a key pasted on a phone easily picks up a space or line break.
    const apiKey = Parameter?.Value?.trim();
    if (!apiKey) throw new Error(`Parameter ${parameterName} is empty`);
    return apiKey;
  };
}

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { normalizeBarcode, tagSchema, uniqueTags } from '@puzzle-log/shared';
import type { AnthropicClientProvider } from '../anthropic.js';
import {
  DetailsUnavailableError,
  type DetailsFinder,
  type DetailsOutcome,
  type DetailsRequest,
  type DetailsResult,
} from './types.js';

const MODEL = 'claude-sonnet-5-5';

/**
 * Batch prices for the model above, and web search's fee, from the pricing page
 * (platform.claude.com/docs/en/about-claude/pricing, 2026-11): batches are half price on
 * tokens; each search costs 1 cent; fetching pages costs only their tokens. Used only to
 * show an estimate. Anthropic's console has the real bill.
 */
const PRICE = { inputPerMillion: 1, outputPerMillion: 5, perSearch: 0.01 };

const SYSTEM_PROMPT = `You find the published details of a jigsaw puzzle that someone has already finished. You get a photo of the completed puzzle and what they know about it, often just a title an AI guessed from the photo.

Search the web (puzzle makers' catalogs, retailer listings, puzzle databases) for this exact puzzle, and compare the product images you find with the photo. Keep it brief: a few searches. Then call report_details exactly once.

- found: true only if you found a listing that is clearly this puzzle, with the same picture. If you're unsure, report found: false and leave the other fields null.
- title: the official product title, as the maker lists it.
- brand: the maker, e.g. Ravensburger, Buffalo Games, Ceaco.
- piece_count: from the listing.
- barcode: the UPC or EAN of this exact edition, only if a listing shows it. Never guess or construct one. Editions with different piece counts have different barcodes.
- tags: up to 3 tags worth adding, such as the artist (e.g. Thomas Kinkade) or a series or licence (e.g. Disney Dreams Collection). When one of their existing tags fits, use exactly the same spelling. Don't repeat what's in the title.
- sources: the URLs of the pages you used.
- note: one short sentence if there's something they should know (several editions, conflicting piece counts), otherwise null.`;

/** The answer tool. `strict` makes the API guarantee the input matches this schema. */
const REPORT_TOOL: Anthropic.Messages.Tool = {
  name: 'report_details',
  description: "Report the puzzle's published details. Call exactly once, at the end.",
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['found', 'title', 'brand', 'piece_count', 'barcode', 'tags', 'sources', 'note'],
    properties: {
      found: { type: 'boolean' },
      title: { type: ['string', 'null'] },
      brand: { type: ['string', 'null'] },
      piece_count: { type: ['integer', 'null'] },
      barcode: { type: ['string', 'null'], description: 'UPC or EAN digits only' },
      tags: { type: 'array', items: { type: 'string' } },
      sources: { type: 'array', items: { type: 'string' } },
      note: { type: ['string', 'null'] },
    },
  },
};

const reportSchema = z.object({
  found: z.boolean(),
  title: z.string().nullable(),
  brand: z.string().nullable(),
  piece_count: z.number().int().nullable(),
  barcode: z.string().nullable(),
  tags: z.array(z.string()),
  sources: z.array(z.string()),
  note: z.string().nullable(),
});

function describe(request: DetailsRequest) {
  return [
    `Title so far: ${request.title}`,
    request.brand && `Brand so far: ${request.brand}`,
    request.pieceCount && `Pieces so far: ${request.pieceCount}`,
    request.knownTags.length
      ? `Their existing tags: ${request.knownTags.join(', ')}`
      : 'They have no tags yet.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** One batch request: the photo is embedded, since the batch may run after any link expires. */
export function batchParams(
  request: DetailsRequest,
): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    // Thinking counts toward this. The report itself is small.
    max_tokens: 8000,
    // Searching and comparing pictures benefits from some thought, not the maximum.
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    tools: [
      // Hard caps on what one puzzle can cost: 4 searches, 2 page reads.
      { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 2 },
      REPORT_TOOL,
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: request.photo.contentType as 'image/jpeg',
              data: Buffer.from(request.photo.bytes).toString('base64'),
            },
          },
          { type: 'text', text: describe(request) },
        ],
      },
    ],
  };
}

/** Turns a finished request into an outcome: the report tool's input, cleaned up. */
export function outcomeFrom(message: Anthropic.Messages.Message): DetailsOutcome {
  const call = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'report_details',
  );
  if (!call) return { status: 'failed', reason: `No report (stop reason: ${message.stop_reason})` };
  const parsed = reportSchema.safeParse(call.input);
  if (!parsed.success) return { status: 'failed', reason: 'Report did not match the schema' };
  const report = parsed.data;
  if (!report.found) return { status: 'not_found' };

  const tags = report.tags.flatMap((tag) => {
    const result = tagSchema.safeParse(tag);
    return result.success ? [result.data] : [];
  });
  const sources = report.sources.filter((url) => /^https?:\/\//.test(url)).slice(0, 5);
  return {
    status: 'found',
    proposal: {
      ...(report.title?.trim() && { title: report.title.trim().slice(0, 200) }),
      ...(report.brand?.trim() && { brand: report.brand.trim().slice(0, 100) }),
      ...(report.piece_count &&
        report.piece_count > 0 &&
        report.piece_count < 1_000_000 && { pieceCount: report.piece_count }),
      // Only a barcode with a valid check digit is kept; the rest are likely misreadings.
      ...(report.barcode &&
        normalizeBarcode(report.barcode) && {
          barcode: normalizeBarcode(report.barcode),
        }),
      tags: uniqueTags(tags).slice(0, 3),
      sources,
      ...(report.note?.trim() && { note: report.note.trim().slice(0, 300) }),
    },
  };
}

export function estimateCost(usage: Anthropic.Messages.Usage) {
  const input =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  return (
    (input * PRICE.inputPerMillion) / 1e6 +
    (usage.output_tokens * PRICE.outputPerMillion) / 1e6 +
    searches * PRICE.perSearch
  );
}

/**
 * Runs the search through the Message Batches API: half the token price, and no 30-second
 * limit, since Anthropic works through the batch in the background (usually within an hour).
 */
export class ClaudeDetailsFinder implements DetailsFinder {
  constructor(private readonly anthropic: AnthropicClientProvider) {}

  private async call<T>(work: (client: Anthropic) => Promise<T>) {
    try {
      return await work(await this.anthropic.get());
    } catch (error) {
      this.anthropic.noteError(error);
      throw new DetailsUnavailableError('The details search is unavailable', { cause: error });
    }
  }

  start(requests: DetailsRequest[]) {
    return this.call(async (client) => {
      const batch = await client.messages.batches.create({
        requests: requests.map((request) => ({
          custom_id: request.puzzleId,
          params: batchParams(request),
        })),
      });
      return batch.id;
    });
  }

  isDone(batchId: string) {
    return this.call(async (client) => {
      const batch = await client.messages.batches.retrieve(batchId);
      return batch.processing_status === 'ended';
    });
  }

  async *results(batchId: string): AsyncIterable<DetailsResult> {
    const results = await this.call((client) => client.messages.batches.results(batchId));
    for await (const { custom_id, result } of results) {
      if (result.type === 'succeeded') {
        yield {
          puzzleId: custom_id,
          outcome: outcomeFrom(result.message),
          costUsd: estimateCost(result.message.usage),
        };
      } else {
        yield {
          puzzleId: custom_id,
          outcome: { status: 'failed', reason: `Request ${result.type}` },
          costUsd: 0,
        };
      }
    }
  }
}

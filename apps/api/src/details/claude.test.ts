import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { batchParams, estimateCost, outcomeFrom } from './claude.js';

function messageWith(input: unknown, stop_reason = 'tool_use'): Anthropic.Messages.Message {
  return {
    content: [{ type: 'tool_use', id: 't1', name: 'report_details', input }],
    stop_reason,
  } as unknown as Anthropic.Messages.Message;
}

const report = {
  found: true,
  title: ' Hogwarts Castle ',
  brand: 'Ravensburger',
  piece_count: 1000,
  barcode: '4005556165001',
  tags: ['Harry Potter', 'harry potter', ''],
  sources: ['https://www.ravensburger.com/x', 'javascript:alert(1)'],
  note: null,
};

describe('outcomeFrom', () => {
  it('turns a report into a cleaned-up proposal', () => {
    expect(outcomeFrom(messageWith(report))).toEqual({
      status: 'found',
      proposal: {
        title: 'Hogwarts Castle',
        brand: 'Ravensburger',
        pieceCount: 1000,
        barcode: '4005556165001',
        tags: ['Harry Potter'],
        sources: ['https://www.ravensburger.com/x'],
      },
    });
  });

  it('drops a barcode with a wrong check digit', () => {
    const outcome = outcomeFrom(messageWith({ ...report, barcode: '4005556165002' }));
    expect(outcome.status === 'found' && outcome.proposal.barcode).toBeUndefined();
  });

  it('reports not found, and a missing or malformed report as failed', () => {
    expect(outcomeFrom(messageWith({ ...report, found: false }))).toEqual({ status: 'not_found' });
    expect(
      outcomeFrom({
        content: [],
        stop_reason: 'pause_turn',
      } as unknown as Anthropic.Messages.Message),
    ).toMatchObject({ status: 'failed' });
    expect(outcomeFrom(messageWith({ found: 'yes' }))).toMatchObject({ status: 'failed' });
  });
});

describe('batchParams', () => {
  it('embeds the photo and caps the searches', () => {
    const params = batchParams({
      puzzleId: 'p1',
      title: 'Castle at Night',
      knownTags: ['Disney'],
      photo: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' },
    });
    const content = params.messages[0]!.content as Anthropic.Messages.ContentBlockParam[];
    expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', data: 'AQID' } });
    expect(content[1]).toMatchObject({ text: expect.stringContaining('Disney') });
    expect(params.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'web_search', max_uses: 4 }),
        expect.objectContaining({ name: 'web_fetch', max_uses: 2 }),
        expect.objectContaining({ name: 'report_details', strict: true }),
      ]),
    );
  });
});

describe('estimateCost', () => {
  it('adds batch token prices and search fees', () => {
    const usage = {
      input_tokens: 20_000,
      output_tokens: 2_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: { web_search_requests: 3, web_fetch_requests: 1 },
    } as unknown as Anthropic.Messages.Usage;
    // 20k × $1/M + 2k × $5/M + 3 × $0.01
    expect(estimateCost(usage)).toBeCloseTo(0.02 + 0.01 + 0.03);
  });
});

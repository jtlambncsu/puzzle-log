import { describe, expect, it, vi } from 'vitest';
import { apiKeyFromSsm, ClaudeSuggester, cleanSuggestion } from './claude.js';
import { SuggestionUnavailableError } from './types.js';

describe('cleanSuggestion', () => {
  it('keeps only values the puzzle schema accepts', () => {
    expect(
      cleanSuggestion({
        title: '  Lighthouse at Sunset ',
        brand: ' ',
        tags: ['Lighthouses', 'lighthouses', '', 'x'.repeat(40), 'Sunset'],
      }),
    ).toEqual({ title: 'Lighthouse at Sunset', tags: ['Lighthouses', 'Sunset'] });
  });

  it('never returns an empty title', () => {
    expect(cleanSuggestion({ title: ' ', brand: 'Buffalo Games', tags: [] })).toEqual({
      title: 'Untitled puzzle',
      brand: 'Buffalo Games',
      tags: [],
    });
  });
});

describe('ClaudeSuggester', () => {
  it('loads the key again after Anthropic rejects it, so a replaced key works', async () => {
    const keys = ['old-key', 'new-key'];
    const getApiKey = vi.fn(async () => keys.shift()!);
    const sentKeys: (string | null)[] = [];
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentKeys.push(new Headers(init?.headers).get('authorization'));
      return new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'authentication_error', message: 'Invalid bearer token' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    });
    const suggester = new ClaudeSuggester(getApiKey, { fetch });

    await expect(suggester.suggest('https://photo', [])).rejects.toThrow(
      SuggestionUnavailableError,
    );
    await expect(suggester.suggest('https://photo', [])).rejects.toThrow(
      SuggestionUnavailableError,
    );

    expect(getApiKey).toHaveBeenCalledTimes(2);
    expect(sentKeys).toEqual(['Bearer old-key', 'Bearer new-key']);
  });
});

describe('apiKeyFromSsm', () => {
  it('trims whitespace a pasted key picked up', async () => {
    const ssm = { send: vi.fn(async () => ({ Parameter: { Value: ' sk-ant-key\n' } })) };
    expect(await apiKeyFromSsm('/key', ssm as never)()).toBe('sk-ant-key');
  });
});

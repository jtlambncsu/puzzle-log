import { describe, expect, it } from 'vitest';
import { cleanSuggestion } from './claude.js';

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

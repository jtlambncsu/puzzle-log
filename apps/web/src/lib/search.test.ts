import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { hasTag, matchesSearch, normalize, tagCounts } from './search';

function puzzle(fields: Partial<Puzzle> & { title: string }): Puzzle {
  return { id: fields.title, userId: 'u', createdAt: '', ...fields };
}

const hoth = puzzle({
  title: 'Battle of Hoth',
  brand: 'Ravensburger',
  notes: 'Lots of snow',
  tags: ['Star Wars'],
});

describe('matchesSearch', () => {
  it.each(['hoth', 'HOTH', 'ravens', 'snow', 'star wars', 'wars star', 'hoth star', ''])(
    'finds %j',
    (query) => {
      expect(matchesSearch(hoth, query)).toBe(true);
    },
  );

  it.each(['endor', 'hoth endor'])('does not find %j', (query) => {
    expect(matchesSearch(hoth, query)).toBe(false);
  });

  it('searches piece counts', () => {
    const endor = puzzle({ title: 'Endor', pieceCount: 1000, tags: ['Star Wars'] });
    expect(matchesSearch(endor, '1000 star wars')).toBe(true);
    expect(matchesSearch(endor, '500')).toBe(false);
  });

  it('ignores accents', () => {
    expect(matchesSearch(puzzle({ title: 'Café Terrace' }), 'cafe')).toBe(true);
    expect(normalize('Ñandú')).toBe('nandu');
  });
});

describe('tags', () => {
  it('matches tags ignoring case', () => {
    expect(hasTag(hoth, 'star wars')).toBe(true);
    expect(hasTag(hoth, 'Disney')).toBe(false);
  });

  it('labels a tag with its most common spelling, capitalized on a tie', () => {
    const tagged = (...tags: string[]) => puzzle({ title: tags.join(), tags });
    expect(tagCounts([tagged('star wars'), tagged('Star Wars')])[0]?.tag).toBe('Star Wars');
    expect(tagCounts([tagged('disney'), tagged('disney'), tagged('Disney')])[0]).toEqual({
      tag: 'disney',
      count: 3,
    });
  });

  it('counts tags across puzzles, most used first, merging spellings', () => {
    expect(
      tagCounts([
        hoth,
        puzzle({ title: 'Endor', tags: ['star wars', 'Forest'] }),
        puzzle({ title: 'Plain' }),
      ]),
    ).toEqual([
      { tag: 'Star Wars', count: 2 },
      { tag: 'Forest', count: 1 },
    ]);
  });
});

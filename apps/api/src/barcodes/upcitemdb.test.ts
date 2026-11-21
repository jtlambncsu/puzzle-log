import { describe, expect, it, vi } from 'vitest';
import { LookupUnavailableError, pieceCountFromTitle, UpcItemDbLookup } from './upcitemdb.js';

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe('UpcItemDbLookup', () => {
  it('maps a found product, reading the piece count from the title', async () => {
    // Shape of a real response for a Ceaco box (UPC 021081311144).
    const fetchImpl = fakeFetch(200, {
      code: 'OK',
      total: 1,
      items: [
        {
          title: 'Ceaco 1000 Piece Cinderella Wishes Upon A Dream Interlocking Jigsaw Puzzle',
          brand: 'Ceaco',
          images: ['http://insecure.example/a.jpg', 'https://images.example/b.jpg'],
        },
      ],
    });
    const lookup = new UpcItemDbLookup('https://upc.example/lookup', fetchImpl);

    expect(await lookup.lookup('0021081311144')).toEqual({
      title: 'Ceaco 1000 Piece Cinderella Wishes Upon A Dream Interlocking Jigsaw Puzzle',
      brand: 'Ceaco',
      pieceCount: 1000,
      imageUrl: 'https://images.example/b.jpg', // https only: the app is served over https
    });
    expect(vi.mocked(fetchImpl).mock.calls[0]?.[0]).toBe(
      'https://upc.example/lookup?upc=0021081311144',
    );
  });

  it('returns undefined for unknown barcodes', async () => {
    expect(
      await new UpcItemDbLookup('x', fakeFetch(200, { code: 'OK', items: [] })).lookup('1'),
    ).toBeUndefined();
    expect(await new UpcItemDbLookup('x', fakeFetch(404)).lookup('1')).toBeUndefined();
  });

  it('reports rate limits and outages as unavailable', async () => {
    await expect(new UpcItemDbLookup('x', fakeFetch(429)).lookup('1')).rejects.toBeInstanceOf(
      LookupUnavailableError,
    );
    const failing = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    await expect(new UpcItemDbLookup('x', failing).lookup('1')).rejects.toBeInstanceOf(
      LookupUnavailableError,
    );
  });
});

describe('pieceCountFromTitle', () => {
  it.each([
    ['Ceaco 1000 Piece Cinderella', 1000],
    ['LEGO® Retro Space Explorer Puzzle 1000 Pieces 26.75 x 19.75 inches', 1000],
    ['Star Wars 500pc puzzle', 500],
    ['Buffalo 2000-piece', 2000],
    ['A puzzle with no count', undefined],
  ])('%s → %s', (title, expected) => {
    expect(pieceCountFromTitle(title)).toBe(expected);
  });
});

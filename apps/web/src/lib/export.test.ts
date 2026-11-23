import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { photoFileName, photoParts, PHOTOS_PER_ZIP, puzzlesToCsv } from './export';

const puzzle = (extra: Partial<Puzzle> = {}): Puzzle => ({
  id: '1a2b3c4d-0000-0000-0000-000000000000',
  userId: 'u',
  title: 'Hogwarts at Night',
  createdAt: '2026-11-01T10:00:00Z',
  ...extra,
});

describe('photoFileName', () => {
  it('is readable and unique', () => {
    expect(photoFileName(puzzle())).toBe('hogwarts-at-night-1a2b3c4d.jpg');
    expect(photoFileName(puzzle({ title: 'Café “Noir”!' }))).toBe('cafe-noir-1a2b3c4d.jpg');
    expect(photoFileName(puzzle({ title: '???' }))).toBe('puzzle-1a2b3c4d.jpg');
  });
});

describe('puzzlesToCsv', () => {
  it('writes one row per puzzle that spreadsheets read back intact', () => {
    const csv = puzzlesToCsv(
      [
        puzzle({
          pieceCount: 1000,
          tags: ['Harry Potter', 'Castles'],
          notes: 'Tricky sky, "very" blue,\nsecond line',
          imageKey: 'uploads/u/x',
          sessions: [{ start: '2026-11-01T10:00:00Z', end: '2026-11-01T11:30:00Z' }],
        }),
        puzzle({ id: 'ffffffff-1', title: 'Wishful', status: 'wishlist' }),
      ],
      Date.parse('2026-11-02T00:00:00Z'),
    );

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const { data } = Papa.parse<Record<string, string>>(csv.slice(1), { header: true });
    expect(data[0]).toMatchObject({
      Title: 'Hogwarts at Night',
      Status: 'done',
      Pieces: '1000',
      'Hours spent': '1.5',
      Tags: 'Harry Potter; Castles',
      Notes: 'Tricky sky, "very" blue,\nsecond line',
      Added: '2026-11-01',
      Photo: 'hogwarts-at-night-1a2b3c4d.jpg',
    });
    expect(data[1]).toMatchObject({ Title: 'Wishful', Status: 'wishlist', Photo: '' });
  });
});

describe('photoParts', () => {
  it('splits puzzles with photos into zip-sized parts', () => {
    const puzzles = Array.from({ length: PHOTOS_PER_ZIP + 5 }, (_, i) =>
      puzzle({ id: String(i), imageUrl: `https://x/${i}` }),
    );
    puzzles.push(puzzle({ id: 'no-photo' }));
    expect(photoParts(puzzles).map((part) => part.length)).toEqual([PHOTOS_PER_ZIP, 5]);
  });
});

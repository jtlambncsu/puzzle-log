import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import {
  existingFrom,
  fingerprintDistance,
  fingerprintToHex,
  groupPhotos,
  lookDistance,
  type AnalyzedPhoto,
} from './photoImport';

/** A test photo. `fingerprint` is its upright look; `rotated` its other three orientations. */
function photo(
  name: string,
  {
    hash = name.padEnd(64, '0'),
    fingerprint,
    rotated = [],
    takenAt,
    size = 1000,
  }: Partial<AnalyzedPhoto> & { size?: number; fingerprint?: bigint; rotated?: bigint[] },
): AnalyzedPhoto {
  return {
    file: new File([new Uint8Array(size)], name),
    hash,
    fingerprints: fingerprint === undefined ? undefined : [fingerprint, ...rotated],
    takenAt,
  };
}

function savedPuzzle(title: string, extra: Partial<Puzzle> = {}): Puzzle {
  return { id: title, userId: 'u', createdAt: '2026-01-01', title, ...extra };
}

// Fingerprints with a known number of differing bits.
const base = 0xf0f0_f0f0_f0f0_f0f0n;
const flip = (bits: number) => base ^ ((1n << BigInt(bits)) - 1n);

describe('fingerprintDistance', () => {
  it('counts differing bits', () => {
    expect(fingerprintDistance(base, base)).toBe(0);
    expect(fingerprintDistance(base, flip(5))).toBe(5);
    expect(fingerprintDistance(0n, (1n << 64n) - 1n)).toBe(64);
  });
});

describe('groupPhotos', () => {
  it('joins near-identical photos whenever they were taken', () => {
    const { groups } = groupPhotos([
      photo('a', { fingerprint: base, takenAt: '2024-01-01T10:00:00' }),
      photo('b', { fingerprint: flip(4), takenAt: '2025-06-01T10:00:00', size: 5000 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.best.file.name).toBe('b'); // the largest file
    expect(groups[0]!.date).toBe('2024-01-01'); // the earliest photo
  });

  it('joins looser matches only when taken within minutes of each other', () => {
    const { groups } = groupPhotos([
      photo('a', { fingerprint: base, takenAt: '2024-01-01T10:00:00' }),
      photo('b', { fingerprint: flip(15), takenAt: '2024-01-01T10:04:00' }),
      // Also 15 bits from a, but different bits from b's, months later.
      photo('c', {
        fingerprint: base ^ (((1n << 15n) - 1n) << 40n),
        takenAt: '2024-03-01T10:04:00',
      }),
    ]);
    expect(groups.map((g) => g.photos.map((p) => p.file.name))).toEqual([['a', 'b'], ['c']]);
  });

  it('keeps different pictures apart, even taken together', () => {
    const { groups } = groupPhotos([
      photo('a', { fingerprint: base, takenAt: '2024-01-01T10:00:00' }),
      photo('b', { fingerprint: flip(32), takenAt: '2024-01-01T10:01:00' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('joins chains of matches into one group', () => {
    const { groups } = groupPhotos([
      photo('a', { fingerprint: base }),
      photo('b', { fingerprint: flip(7) }),
      photo('c', { fingerprint: flip(7) ^ 0xff00_0000_0000_0000n }), // close to b, far from a
    ]);
    expect(groups).toHaveLength(1);
  });

  it('drops exact copies and photos imported before', () => {
    const result = groupPhotos(
      [
        photo('a', { hash: 'a'.repeat(64) }),
        photo('copy of a', { hash: 'a'.repeat(64) }),
        photo('old', { hash: 'b'.repeat(64) }),
        photo('undecodable', {}),
      ],
      existingFrom([savedPuzzle('Old', { importHashes: ['b'.repeat(64)] })]),
    );
    expect(result).toMatchObject({ exactCopies: 1, alreadyImported: 1 });
    // Without fingerprints, photos are never merged.
    expect(result.groups).toHaveLength(2);
  });

  it('sorts oldest first, undated last', () => {
    const { groups } = groupPhotos([
      photo('none', {}),
      photo('new', { takenAt: '2025-01-01T00:00:00' }),
      photo('old', { takenAt: '2020-01-01T00:00:00' }),
    ]);
    expect(groups.map((g) => g.best.file.name)).toEqual(['old', 'new', 'none']);
  });

  it('skips photos that look like a saved puzzle, even when turned or re-encoded', () => {
    const saved = savedPuzzle('Hogwarts', { photoFingerprint: fingerprintToHex(base) });
    const result = groupPhotos(
      [
        // Re-encoded by the picker: different bytes, nearly the same look.
        photo('again', { fingerprint: flip(3) }),
        // Saved upright, picked sideways: its 90° turn matches.
        photo('sideways', { fingerprint: flip(40), rotated: [flip(2), flip(30), flip(35)] }),
        photo('new', { fingerprint: flip(32) }),
      ],
      existingFrom([saved, savedPuzzle('No photo')]),
    );
    expect(result.looksImported.map((m) => [m.photo.file.name, m.puzzle.title])).toEqual([
      ['again', 'Hogwarts'],
      ['sideways', 'Hogwarts'],
    ]);
    expect(result.groups.map((g) => g.best.file.name)).toEqual(['new']);
  });
});

describe('lookDistance', () => {
  it('compares in the closest orientation', () => {
    expect(lookDistance([base], [flip(30), flip(2)])).toBe(2);
  });
});

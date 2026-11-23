import { describe, expect, it } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { findDuplicateGroups, pairKey } from './duplicates';

const base = 0xf0f0_f0f0_f0f0_f0f0n;
const hex = (value: bigint) => value.toString(16).padStart(16, '0');
const flip = (bits: number) => hex(base ^ ((1n << BigInt(bits)) - 1n));

const puzzle = (id: string, extra: Partial<Puzzle> = {}): Puzzle => ({
  id,
  userId: 'u',
  title: `Puzzle ${id}`,
  createdAt: '2026-01-01',
  ...extra,
});

describe('findDuplicateGroups', () => {
  it('groups near-identical photos and identical titles, with the reasons', () => {
    const groups = findDuplicateGroups([
      puzzle('a', { photoFingerprint: hex(base) }),
      puzzle('b', { photoFingerprint: flip(4) }),
      puzzle('c', { title: 'The Lion King!' }),
      puzzle('d', { title: 'the lion king' }),
      puzzle('e', { photoFingerprint: flip(30) }),
    ]);
    expect(groups.map((g) => [g.puzzles.map((p) => p.id), g.reasons])).toEqual([
      [['a', 'b'], ['photo']],
      [['c', 'd'], ['title']],
    ]);
  });

  it('chains matches into one group, collecting every reason', () => {
    const groups = findDuplicateGroups([
      puzzle('a', { photoFingerprint: hex(base) }),
      puzzle('b', { photoFingerprint: flip(3), title: 'Castle' }),
      puzzle('c', { title: 'Castle' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.puzzles.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0]!.reasons).toEqual(['photo', 'title']);
  });

  it('ignores placeholder titles and pairs marked as not duplicates', () => {
    const groups = findDuplicateGroups(
      [
        puzzle('a', { title: 'Imported puzzle' }),
        puzzle('b', { title: 'Imported puzzle' }),
        puzzle('c', { title: 'Castle' }),
        puzzle('d', { title: 'Castle' }),
      ],
      new Set([pairKey('d', 'c')]),
    );
    expect(groups).toEqual([]);
  });
});

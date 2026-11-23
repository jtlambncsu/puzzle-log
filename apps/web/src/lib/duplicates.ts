import { IMPORTED_TITLE, type Puzzle } from '@puzzle-log/shared';
import { fingerprintDistance } from './photoImport';

/**
 * Finding puzzles that are probably the same one, logged twice: by photo (near-identical
 * fingerprints) or by title (identical once case and punctuation are ignored).
 */

/** Same threshold as the import's "nearly identical" (ADR 0025). */
const SAME_PICTURE = 10;

export type DuplicateReason = 'photo' | 'title';

export interface DuplicateGroup {
  puzzles: Puzzle[];
  reasons: DuplicateReason[];
  /** Stable id for the group: its puzzle ids, sorted. */
  key: string;
}

function normalTitle(title: string) {
  return title
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A pair the user said aren't duplicates, in either order. */
export function pairKey(a: string, b: string) {
  return [a, b].sort().join('|');
}

export function findDuplicateGroups(
  puzzles: readonly Puzzle[],
  notDuplicates: ReadonlySet<string> = new Set(),
): DuplicateGroup[] {
  const fingerprints = puzzles.map((puzzle) =>
    puzzle.photoFingerprint ? BigInt(`0x${puzzle.photoFingerprint}`) : undefined,
  );
  const titles = puzzles.map((puzzle) =>
    puzzle.title === IMPORTED_TITLE ? '' : normalTitle(puzzle.title),
  );

  // Union-find, as in the import: matches chain into groups. Each match is recorded, and
  // its reason assigned to the final group once all merging is done.
  const parent = puzzles.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  const matches: { i: number; reasons: DuplicateReason[] }[] = [];
  for (let i = 0; i < puzzles.length; i++) {
    for (let j = i + 1; j < puzzles.length; j++) {
      if (notDuplicates.has(pairKey(puzzles[i]!.id, puzzles[j]!.id))) continue;
      const [a, b] = [fingerprints[i], fingerprints[j]];
      const found: DuplicateReason[] = [];
      if (a !== undefined && b !== undefined && fingerprintDistance(a, b) <= SAME_PICTURE) {
        found.push('photo');
      }
      if (titles[i] && titles[i] === titles[j]) found.push('title');
      if (!found.length) continue;
      parent[root(j)] = root(i);
      matches.push({ i, reasons: found });
    }
  }
  const reasons = new Map<number, Set<DuplicateReason>>();
  for (const match of matches) {
    const r = root(match.i);
    reasons.set(r, new Set([...(reasons.get(r) ?? []), ...match.reasons]));
  }

  const groups = new Map<number, Puzzle[]>();
  puzzles.forEach((puzzle, i) => {
    const r = root(i);
    groups.set(r, [...(groups.get(r) ?? []), puzzle]);
  });
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([r, members]) => ({
      puzzles: members,
      reasons: [...(reasons.get(r) ?? new Set<DuplicateReason>())].sort(),
      key: members
        .map((puzzle) => puzzle.id)
        .sort()
        .join('|'),
    }));
}

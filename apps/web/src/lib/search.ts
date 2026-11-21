import type { Puzzle } from '@puzzle-log/shared';

/** Lowercase and strip accents, so "Café" matches "cafe". */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

/**
 * True if every word of `query` appears somewhere in the puzzle's title, brand, notes, tags
 * or piece count. Word order doesn't matter, so "wars star" finds "Star Wars", and
 * "1000 star wars" finds 1000-piece Star Wars puzzles.
 */
export function matchesSearch(puzzle: Puzzle, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [puzzle.title, puzzle.brand, puzzle.notes, puzzle.pieceCount, ...(puzzle.tags ?? [])]
      .filter(Boolean)
      .join(' '),
  );
  return words.every((word) => haystack.includes(word));
}

/** Tags are compared ignoring case: "Star Wars" and "star wars" are the same tag. */
export function sameTag(a: string, b: string) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

export function hasTag(puzzle: Puzzle, tag: string) {
  return (puzzle.tags ?? []).some((t) => sameTag(t, tag));
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Every tag in use with how many puzzles have it, most used first. Spellings that differ only
 * in case count as one tag, labelled with its most common spelling (capitalized on a tie).
 */
export function tagCounts(puzzles: readonly Puzzle[]): TagCount[] {
  const groups = new Map<string, Map<string, number>>(); // lowercase tag -> spelling -> count
  for (const puzzle of puzzles) {
    for (const tag of puzzle.tags ?? []) {
      const key = tag.toLocaleLowerCase();
      const spellings = groups.get(key) ?? new Map<string, number>();
      spellings.set(tag, (spellings.get(tag) ?? 0) + 1);
      groups.set(key, spellings);
    }
  }
  const upperFirst = new Intl.Collator(undefined, { caseFirst: 'upper' });
  return [...groups.values()]
    .map((spellings) => {
      const [tag] = [...spellings.entries()].sort(
        ([a, countA], [b, countB]) => countB - countA || upperFirst.compare(a, b),
      )[0]!;
      const count = [...spellings.values()].reduce((sum, n) => sum + n, 0);
      return { tag, count };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

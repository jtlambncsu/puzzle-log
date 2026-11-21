import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { Puzzle } from '@puzzle-log/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/lib/search';
import { PuzzlePhoto } from '@/features/puzzles/PuzzleCard';

interface PickPuzzleProps {
  puzzles: readonly Puzzle[];
  /** Shown before the user searches, e.g. puzzles that look like the scanned product. */
  suggestions: readonly Puzzle[];
  onPick: (puzzle: Puzzle) => void;
  pendingId?: string;
}

/**
 * "Is it one of yours?" Suggested look-alikes, plus a search over the whole log. Picking one
 * saves the barcode on it, so the next scan of this box is an instant exact match.
 */
export function PickPuzzle({ puzzles, suggestions, onPick, pendingId }: PickPuzzleProps) {
  const [query, setQuery] = useState('');
  const shown = query.trim()
    ? puzzles.filter((puzzle) => matchesSearch(puzzle, query)).slice(0, 8)
    : suggestions;

  return (
    <div className="space-y-3">
      <Input
        type="search"
        aria-label="Search your puzzles"
        placeholder="Search your puzzles"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="[&::-webkit-search-cancel-button]:appearance-none"
      />
      {shown.length === 0 ? (
        query.trim() && <p className="text-sm text-muted-foreground">No puzzles match.</p>
      ) : (
        <ul className="divide-y rounded-xl border" aria-label="Your puzzles">
          {shown.map((puzzle) => (
            <li key={puzzle.id} className="flex items-center gap-3 p-2">
              <PuzzlePhoto puzzle={puzzle} className="size-12 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1 truncate">{puzzle.title}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={!!pendingId}
                onClick={() => onPick(puzzle)}
                aria-label={`It's ${puzzle.title}`}
              >
                {pendingId === puzzle.id && <Loader2Icon className="animate-spin" aria-hidden />}
                This one
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

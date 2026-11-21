import { Link } from '@tanstack/react-router';
import { PuzzleIcon } from 'lucide-react';
import type { Puzzle } from '@puzzle-log/shared';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, puzzleSubtitle } from './format';

export function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  return (
    <Link
      to="/puzzles/$puzzleId"
      params={{ puzzleId: puzzle.id }}
      className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <PuzzlePhoto puzzle={puzzle} className="aspect-square" />
        <CardContent className="space-y-0.5 p-3">
          <h2 className="line-clamp-2 font-medium">{puzzle.title}</h2>
          {puzzleSubtitle(puzzle) && (
            <p className="text-sm text-muted-foreground">{puzzleSubtitle(puzzle)}</p>
          )}
          {puzzle.completedAt && (
            <p className="text-xs text-muted-foreground">
              Finished {formatDate(puzzle.completedAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function PuzzlePhoto({ puzzle, className }: { puzzle: Puzzle; className?: string }) {
  if (!puzzle.imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ''}`}>
        <PuzzleIcon className="size-10 text-muted-foreground/50" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={puzzle.imageUrl}
      alt={`Photo of ${puzzle.title}`}
      loading="lazy"
      className={`w-full bg-muted object-cover ${className ?? ''}`}
    />
  );
}

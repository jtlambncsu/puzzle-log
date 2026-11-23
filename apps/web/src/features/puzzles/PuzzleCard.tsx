import { Link } from '@tanstack/react-router';
import { PuzzleIcon } from 'lucide-react';
import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
import { Badge } from '@/components/ui/badge';
import { STATUS_INFO } from '@/lib/status';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, puzzleSubtitle } from './format';
import { Stars } from './StarRating';

export function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  return (
    <Link
      to="/puzzles/$puzzleId"
      params={{ puzzleId: puzzle.id }}
      className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="relative">
          <PuzzlePhoto puzzle={puzzle} className="aspect-square" />
          <StatusBadge puzzle={puzzle} className="absolute top-2 left-2" />
        </div>
        <CardContent className="space-y-0.5 p-3">
          <h2 className="line-clamp-2 font-medium">{puzzle.title}</h2>
          {puzzle.rating && <Stars rating={puzzle.rating} className="[&_svg]:size-3.5" />}
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

export function PuzzlePhoto({
  puzzle,
  className,
  rotation = 0,
}: {
  puzzle: Puzzle;
  className?: string;
  /** Preview-only rotation (CSS), e.g. while choosing how to rotate a saved photo. */
  rotation?: number;
}) {
  // Without a finished photo (e.g. a puzzle not started yet), show the box.
  const src = puzzle.imageUrl ?? puzzle.boxImageUrl;
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ''}`}>
        <PuzzleIcon className="size-10 text-muted-foreground/50" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={puzzle.imageUrl ? `Photo of ${puzzle.title}` : `Box of ${puzzle.title}`}
      loading="lazy"
      decoding="async"
      // Request it with CORS so the service worker can cache it for offline use (browsers
      // hide the contents of no-CORS responses, which the cache then refuses).
      crossOrigin="anonymous"
      className={`w-full bg-muted object-cover ${className ?? ''}`}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
    />
  );
}

/** Marks puzzles that aren't done yet; nothing for done ones, which are the norm. */
export function StatusBadge({ puzzle, className }: { puzzle: Puzzle; className?: string }) {
  const status = puzzleStatus(puzzle);
  if (status === 'done') return null;
  const { label, icon: Icon } = STATUS_INFO[status];
  const timing = puzzle.timerStartedAt !== undefined;
  return (
    <Badge variant="secondary" className={`gap-1 shadow-sm ${className ?? ''}`}>
      <Icon aria-hidden />
      {label}
      {timing && (
        <>
          {/* A pulsing dot while the timer runs; still (not hidden) for reduced motion. */}
          <span
            aria-hidden
            className="ml-0.5 size-1.5 rounded-full bg-red-500 motion-safe:animate-pulse"
          />
          <span className="sr-only">, timer running</span>
        </>
      )}
    </Badge>
  );
}

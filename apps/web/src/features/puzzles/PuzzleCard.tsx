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
      className="group rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden rounded-2xl py-0 shadow-xs transition-shadow group-hover:shadow-md">
        <div className="relative">
          <PuzzlePhoto puzzle={puzzle} className="aspect-square" />
          <StatusBadge puzzle={puzzle} className="absolute top-2 left-2" />
        </div>
        <CardContent className="flex flex-1 flex-col gap-1 p-3">
          <h2 className="line-clamp-2 leading-snug font-semibold">{puzzle.title}</h2>
          {puzzleSubtitle(puzzle) && (
            <p className="text-[0.8rem] text-muted-foreground">{puzzleSubtitle(puzzle)}</p>
          )}
          {(puzzle.rating || puzzle.completedAt) && (
            // Pushed to the bottom, so the dates line up across a row.
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-1">
              {puzzle.rating && <Stars rating={puzzle.rating} className="[&_svg]:size-3" />}
              {puzzle.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Finished {formatDate(puzzle.completedAt)}
                </p>
              )}
            </div>
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
    <Badge
      variant="secondary"
      className={`gap-1 border-0 shadow-sm ${STATUS_BADGE_COLORS[status]} ${className ?? ''}`}
    >
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

/** A tint per status, so the grid can be scanned by color as well as by label. */
const STATUS_BADGE_COLORS = {
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-50',
  owned: 'bg-sky-100 text-sky-900 dark:bg-sky-900/70 dark:text-sky-50',
  wishlist: 'bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-50',
} as const;

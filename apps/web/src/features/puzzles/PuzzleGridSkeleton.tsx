import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder shown while the puzzle list loads, shaped like the real grid. */
export function PuzzleGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading puzzles"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

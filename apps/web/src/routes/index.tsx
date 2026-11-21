import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon, PuzzleIcon } from 'lucide-react';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { PuzzleCard } from '@/features/puzzles/PuzzleCard';
import { PuzzleGridSkeleton } from '@/features/puzzles/PuzzleGridSkeleton';

export const Route = createFileRoute('/')({
  // Start fetching before the page renders; the component then reads from the cache.
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  pendingComponent: PuzzleGridSkeleton,
  component: PuzzleListPage,
});

function PuzzleListPage() {
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));

  if (puzzles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <PuzzleIcon className="size-12 text-muted-foreground/50" aria-hidden />
        <div>
          <h1 className="font-heading text-xl font-semibold">No puzzles yet</h1>
          <p className="text-muted-foreground">Finished one? Snap a photo and log it.</p>
        </div>
        <Button asChild>
          <Link to="/puzzles/new">
            <PlusIcon aria-hidden />
            Add your first puzzle
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">
        Your puzzles <span className="text-muted-foreground">({puzzles.length})</span>
      </h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {puzzles.map((puzzle) => (
          <li key={puzzle.id}>
            <PuzzleCard puzzle={puzzle} />
          </li>
        ))}
      </ul>
    </>
  );
}

import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { Puzzle } from '@puzzle-log/shared';
import { ApiError } from '@/api/client';
import { puzzleQueryOptions, useApi, useDeletePuzzle } from '@/api/queries';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, puzzleSubtitle } from '@/features/puzzles/format';
import { PuzzleTimer } from '@/features/puzzles/PuzzleTimer';
import { PhotoSlots } from '@/features/puzzles/PhotoSlots';
import { Stars } from '@/features/puzzles/StarRating';
import { RotatablePhoto } from '@/features/puzzles/RotatablePhoto';
import { StatusBadge } from '@/features/puzzles/PuzzleCard';
import { StatusActions } from '@/features/puzzles/StatusActions';

export const Route = createFileRoute('/puzzles/$puzzleId')({
  loader: async ({ context: { queryClient, api }, params }) => {
    try {
      await queryClient.ensureQueryData(puzzleQueryOptions(api, params.puzzleId));
    } catch (error) {
      // A missing (or someone else's) puzzle shows the not-found page, not an error.
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  pendingComponent: () => <Skeleton className="aspect-square w-full rounded-xl" />,
  component: PuzzleDetailPage,
});

function PuzzleDetailPage() {
  const { puzzleId } = Route.useParams(); // typed: TanStack Router knows this route's params
  const api = useApi();
  const { data: puzzle } = useSuspenseQuery(puzzleQueryOptions(api, puzzleId));
  const deletePuzzle = useDeletePuzzle();
  const navigate = useNavigate();

  async function handleDelete() {
    try {
      await deletePuzzle.mutateAsync(puzzle.id);
      toast.success(`Deleted “${puzzle.title}”`);
      await navigate({ to: '/' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the puzzle');
    }
  }

  return (
    <article className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeftIcon aria-hidden />
          All puzzles
        </Link>
      </Button>

      <RotatablePhoto puzzle={puzzle} />
      <PhotoSlots puzzle={puzzle} />

      <div>
        <StatusBadge puzzle={puzzle} className="mb-2" />
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-heading text-2xl font-semibold">{puzzle.title}</h1>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/puzzles/$puzzleId/edit" params={{ puzzleId: puzzle.id }}>
              <PencilIcon aria-hidden />
              Edit
            </Link>
          </Button>
        </div>
        {puzzleSubtitle(puzzle) && (
          <p className="text-muted-foreground">{puzzleSubtitle(puzzle)}</p>
        )}
        {(puzzle.startedAt || puzzle.completedAt) && (
          <p className="text-sm text-muted-foreground">
            {[
              puzzle.startedAt && `Started ${formatDate(puzzle.startedAt)}`,
              puzzle.completedAt && `Finished ${formatDate(puzzle.completedAt)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      <HowItWent puzzle={puzzle} />

      <PuzzleTimer puzzle={puzzle} />

      <StatusActions puzzle={puzzle} />

      {puzzle.tags && puzzle.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {puzzle.tags.map((tag) => (
            <li key={tag}>
              {/* Each tag links to the list filtered to that tag. */}
              <Badge asChild variant="secondary" className="h-7 text-sm">
                <Link to="/" search={{ tag }}>
                  {tag}
                </Link>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {puzzle.notes && <p className="whitespace-pre-wrap">{puzzle.notes}</p>}

      {puzzle.barcode && <p className="text-sm text-muted-foreground">Barcode {puzzle.barcode}</p>}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={deletePuzzle.isPending}>
            <Trash2Icon aria-hidden />
            Delete puzzle
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{puzzle.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

/** The rating and notes on how it went, for finished puzzles that have any. */
function HowItWent({ puzzle }: { puzzle: Puzzle }) {
  const parts = [
    puzzle.difficulty && DIFFICULTY_LABELS[puzzle.difficulty],
    puzzle.missingPieces !== undefined &&
      (puzzle.missingPieces === 0
        ? 'No missing pieces'
        : `${puzzle.missingPieces} missing ${puzzle.missingPieces === 1 ? 'piece' : 'pieces'}`),
    puzzle.wouldRedo !== undefined && (puzzle.wouldRedo ? 'Would do again' : "Wouldn't do again"),
  ].filter(Boolean);
  if (!puzzle.rating && !parts.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {puzzle.rating && <Stars rating={puzzle.rating} />}
      {parts.join(' · ')}
    </div>
  );
}

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

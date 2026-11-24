import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
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
import { formatDate } from '@/features/puzzles/format';
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

  const inProgress = puzzleStatus(puzzle) === 'in_progress';
  const timerAndActions = (
    <>
      <PuzzleTimer puzzle={puzzle} />
      <StatusActions puzzle={puzzle} />
    </>
  );

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
    <article className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeftIcon aria-hidden />
          All puzzles
        </Link>
      </Button>

      <header className="space-y-2">
        <StatusBadge puzzle={puzzle} />
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight">
            {puzzle.title}
          </h1>
          <Button asChild variant="outline" size="sm" className="mt-1 shrink-0">
            <Link to="/puzzles/$puzzleId/edit" params={{ puzzleId: puzzle.id }}>
              <PencilIcon aria-hidden />
              Edit
            </Link>
          </Button>
        </div>
        <HowItWent puzzle={puzzle} />
      </header>

      {/* While it's being worked on, the timer comes first; otherwise the photo does. */}
      {inProgress && timerAndActions}
      <RotatablePhoto puzzle={puzzle} />
      <PhotoSlots puzzle={puzzle} />

      <Facts puzzle={puzzle} />

      {!inProgress && timerAndActions}

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

      {puzzle.notes && (
        <section className="rounded-2xl border bg-card p-4" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="mb-1 text-xs font-medium text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap">{puzzle.notes}</p>
        </section>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deletePuzzle.isPending}
          >
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

/** The puzzle's details, as a grid of small labeled values. */
function Facts({ puzzle }: { puzzle: Puzzle }) {
  const facts = [
    ['Pieces', puzzle.pieceCount?.toLocaleString()],
    ['Brand', puzzle.brand],
    ['Started', puzzle.startedAt && formatDate(puzzle.startedAt)],
    ['Finished', puzzle.completedAt && formatDate(puzzle.completedAt)],
    ['Barcode', puzzle.barcode],
  ].filter((fact): fact is [string, string] => !!fact[1]);
  if (!facts.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border">
      {facts.map(([label, value]) => (
        <div key={label} className="bg-card px-4 py-3 last:odd:col-span-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate font-medium">{value}</dd>
        </div>
      ))}
    </dl>
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

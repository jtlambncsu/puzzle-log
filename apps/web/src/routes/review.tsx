import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueries, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IMPORTED_TITLE, type Puzzle } from '@puzzle-log/shared';
import {
  puzzlesQueryOptions,
  suggestionQueryOptions,
  useApi,
  useDeletePuzzle,
  useUpdatePuzzle,
} from '@/api/queries';
import { Button } from '@/components/ui/button';
import { reviewQueue } from '@/features/review/queue';
import { ReviewForm, type ReviewedValues } from '@/features/review/ReviewForm';
import { RotatablePhoto } from '@/features/puzzles/RotatablePhoto';

export const Route = createFileRoute('/review')({
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  component: ReviewPage,
});

/** How many puzzles ahead to ask AI about, so a suggestion is usually ready on arrival. */
const PREFETCH = 4;

/**
 * One imported puzzle at a time: check AI's title and tags, fix them, Save & next. Fast
 * enough to get through hundreds on the couch.
 */
function ReviewPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const updatePuzzle = useUpdatePuzzle();
  const deletePuzzle = useDeletePuzzle();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  // The last puzzle saved here, for "Same puzzle as the last one".
  const [lastSaved, setLastSaved] = useState<Puzzle>();

  const queue = reviewQueue(puzzles);
  const upcoming = queue.filter((puzzle) => !skipped.has(puzzle.id));
  const current = upcoming[0];

  // Name the current puzzle and the next few in the background. Results come back in the
  // same order as `toName`, so the current puzzle's is at its index there.
  const toName = upcoming.slice(0, PREFETCH).filter((puzzle) => puzzle.title === IMPORTED_TITLE);
  const suggestions = useQueries({
    queries: toName.map((puzzle) => suggestionQueryOptions(api, queryClient, puzzle.id)),
  });
  const currentSuggestion = suggestions[toName.findIndex((p) => p.id === current?.id)];
  const suggesting = currentSuggestion?.isFetching ?? false;
  const suggestionFailed = currentSuggestion?.isError ?? false;

  if (!current) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-lg font-medium">
          {skipped.size ? `You skipped ${skipped.size}.` : 'All caught up! 🧩'}
        </p>
        <div className="flex justify-center gap-2">
          {skipped.size > 0 && (
            <Button onClick={() => setSkipped(new Set())}>Go through the skipped ones</Button>
          )}
          <Button asChild variant="outline">
            <Link to="/">Back to your puzzles</Link>
          </Button>
        </div>
      </div>
    );
  }

  const busy = updatePuzzle.isPending || deletePuzzle.isPending;
  const onError = (error: Error) => toast.error(error.message);

  function save(values: ReviewedValues) {
    updatePuzzle.mutate(
      { id: current!.id, patch: { ...values, needsReview: null } },
      { onSuccess: (saved) => setLastSaved(saved), onError },
    );
  }

  async function mergeIntoLast() {
    if (!lastSaved || !current) return;
    try {
      // Keep this photo's hashes on the kept puzzle, so a re-import skips it.
      const importHashes = [
        ...new Set([...(lastSaved.importHashes ?? []), ...(current.importHashes ?? [])]),
      ].slice(0, 50);
      const kept = await updatePuzzle.mutateAsync({ id: lastSaved.id, patch: { importHashes } });
      await deletePuzzle.mutateAsync(current.id);
      setLastSaved(kept);
      toast.success(`Merged into “${kept.title}”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not merge');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold">Review imports</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {upcoming.length} left
        </p>
      </div>

      {/* Small enough that the title and Save & next fit on a phone screen with it. */}
      <div className="mx-auto w-full max-w-64">
        <RotatablePhoto puzzle={current} />
      </div>

      {lastSaved && (
        <Button
          variant="outline"
          className="h-auto w-full justify-start gap-3 py-2"
          disabled={busy}
          onClick={() => void mergeIntoLast()}
        >
          {lastSaved.imageUrl && (
            <img
              src={lastSaved.imageUrl}
              alt=""
              crossOrigin="anonymous"
              className="size-10 rounded object-cover"
            />
          )}
          <span className="truncate">Same puzzle as “{lastSaved.title}”</span>
        </Button>
      )}

      <ReviewForm
        // A new form per puzzle (and once its suggestion arrives), starting from its values.
        key={`${current.id}:${current.title}`}
        puzzle={current}
        suggesting={suggesting}
        suggestionFailed={suggestionFailed}
        onRetrySuggestion={() => void currentSuggestion?.refetch()}
        busy={busy}
        onSave={save}
        onSkip={() => setSkipped(new Set([...skipped, current.id]))}
        onDelete={() =>
          deletePuzzle.mutate(current.id, {
            onSuccess: () => toast.success('Deleted'),
            onError,
          })
        }
      />
    </div>
  );
}

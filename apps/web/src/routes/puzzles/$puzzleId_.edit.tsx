import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { puzzleQueryOptions, useApi, useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { PuzzleForm } from '@/features/puzzles/PuzzleForm';
import { puzzleToFormValues, toUpdatePuzzleInput } from '@/features/puzzles/puzzleForm';

// The trailing underscore in `$puzzleId_` makes this page stand alone rather than render
// inside the puzzle detail page, while keeping the URL /puzzles/<id>/edit.
export const Route = createFileRoute('/puzzles/$puzzleId_/edit')({
  loader: async ({ context: { queryClient, api }, params }) => {
    try {
      await queryClient.ensureQueryData(puzzleQueryOptions(api, params.puzzleId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  component: EditPuzzlePage,
});

function EditPuzzlePage() {
  const { puzzleId } = Route.useParams();
  const api = useApi();
  const { data: puzzle } = useSuspenseQuery(puzzleQueryOptions(api, puzzleId));
  const updatePuzzle = useUpdatePuzzle();
  const navigate = useNavigate();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/puzzles/$puzzleId" params={{ puzzleId }}>
          <ArrowLeftIcon aria-hidden />
          Back
        </Link>
      </Button>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit puzzle</h1>
      <PuzzleForm
        withPhoto={false}
        // Re-mount if a different puzzle loads, so the form starts from its values.
        key={puzzle.id}
        defaultValues={puzzleToFormValues(puzzle)}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          try {
            await updatePuzzle.mutateAsync({ id: puzzleId, patch: toUpdatePuzzleInput(values) });
            toast.success('Saved');
            await navigate({ to: '/puzzles/$puzzleId', params: { puzzleId } });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save your changes');
          }
        }}
      />
    </>
  );
}

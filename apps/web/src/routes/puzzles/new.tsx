import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ImagesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { PuzzleForm } from '@/features/puzzles/PuzzleForm';
import { emptyPuzzleForm, toCreatePuzzleInput } from '@/features/puzzles/puzzleForm';

/**
 * Optional pre-fill, e.g. from a barcode scan: /puzzles/new?title=…&brand=…&pieces=…&barcode=…
 * The router parses numbers in the URL, so text fields accept them too.
 */
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);

const newPuzzleSearchSchema = z.object({
  title: text,
  brand: text,
  pieces: z.coerce.number().int().positive().optional().catch(undefined),
  barcode: text,
});

export const Route = createFileRoute('/puzzles/new')({
  validateSearch: newPuzzleSearchSchema,
  component: NewPuzzlePage,
});

function NewPuzzlePage() {
  const navigate = useNavigate();
  const prefill = Route.useSearch();
  const createPuzzle = useCreatePuzzle();

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold">Add a puzzle</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/puzzles/bulk">
            <ImagesIcon aria-hidden />
            Add several
          </Link>
        </Button>
      </div>
      <PuzzleForm
        defaultValues={{
          ...emptyPuzzleForm,
          title: prefill.title ?? '',
          brand: prefill.brand ?? '',
          pieceCount: prefill.pieces ? String(prefill.pieces) : '',
          barcode: prefill.barcode ?? '',
        }}
        onSubmit={async (values, photo, rotation) => {
          try {
            const input = toCreatePuzzleInput(values);
            const puzzle = await createPuzzle.mutateAsync({ input, photo, rotation });
            toast.success(`Saved “${puzzle.title}”`);
            await navigate({ to: '/' });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save the puzzle');
          }
        }}
      />
    </>
  );
}

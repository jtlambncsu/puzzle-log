import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ImagesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { PuzzleForm } from '@/features/puzzles/PuzzleForm';

export const Route = createFileRoute('/puzzles/new')({
  component: NewPuzzlePage,
});

function NewPuzzlePage() {
  const navigate = useNavigate();
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
        onSubmit={async (input, photo) => {
          try {
            const puzzle = await createPuzzle.mutateAsync({ input, photo });
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

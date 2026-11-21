import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useCreatePuzzle } from '@/api/queries';
import { PuzzleForm } from '@/features/puzzles/PuzzleForm';

export const Route = createFileRoute('/puzzles/new')({
  component: NewPuzzlePage,
});

function NewPuzzlePage() {
  const navigate = useNavigate();
  const createPuzzle = useCreatePuzzle();

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Add a puzzle</h1>
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

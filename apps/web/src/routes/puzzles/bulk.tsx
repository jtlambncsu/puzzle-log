import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { BulkAddForm } from '@/features/puzzles/BulkAddForm';
import { MAX_BULK_PHOTOS } from '@/features/puzzles/bulkForm';

export const Route = createFileRoute('/puzzles/bulk')({
  component: BulkAddPage,
});

function BulkAddPage() {
  const navigate = useNavigate();

  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Add several puzzles</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Pick up to {MAX_BULK_PHOTOS} photos. Dates are filled in from the photos when they have one;
        add a title to each and save them all at once.
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        Have hundreds of old photos?{' '}
        <Link to="/puzzles/import" className="font-medium text-foreground underline">
          Import a whole album
        </Link>{' '}
        instead: duplicates are skipped and AI suggests the titles.
      </p>
      <BulkAddForm
        onDone={({ saved, failed }) => {
          if (failed === 0) {
            toast.success(`Saved ${saved} ${saved === 1 ? 'puzzle' : 'puzzles'}`);
            void navigate({ to: '/' });
          } else {
            toast.error(
              `${failed} ${failed === 1 ? "puzzle wasn't" : "puzzles weren't"} saved. Tap Save to try again.`,
            );
          }
        }}
      />
    </>
  );
}

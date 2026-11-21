import { CircleCheckBigIcon, Loader2Icon, PackageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { puzzleStatus, type Puzzle, type UpdatePuzzleInput } from '@puzzle-log/shared';
import { useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { today } from '@/lib/date';

/**
 * One-tap moves along wishlist → owned → done, the common changes after a shop trip or after
 * finishing a puzzle. Anything else goes through Edit.
 */
export function StatusActions({ puzzle }: { puzzle: Puzzle }) {
  const updatePuzzle = useUpdatePuzzle();
  const status = puzzleStatus(puzzle);
  if (status === 'done') return null;

  const [label, Icon, patch, message]: [string, typeof PackageIcon, UpdatePuzzleInput, string] =
    status === 'wishlist'
      ? ['I bought it', PackageIcon, { status: 'owned' }, 'Moved to owned']
      : [
          'Mark as done',
          CircleCheckBigIcon,
          { status: 'done', completedAt: today() },
          'Nice work! 🧩',
        ];

  return (
    <Button
      className="w-full"
      disabled={updatePuzzle.isPending}
      onClick={() =>
        updatePuzzle.mutate(
          { id: puzzle.id, patch },
          {
            onSuccess: () => toast.success(message),
            onError: (error) => toast.error(error.message),
          },
        )
      }
    >
      {updatePuzzle.isPending ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <Icon aria-hidden />
      )}
      {label}
    </Button>
  );
}

import { CircleCheckBigIcon, Loader2Icon, PackageIcon, PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
import { useTimer, useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { today } from '@/lib/date';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

/**
 * One-tap moves along wishlist → owned → in progress → done: after a shop trip, when sitting
 * down to start, and when the last piece goes in. Anything else goes through Edit.
 */
export function StatusActions({ puzzle }: { puzzle: Puzzle }) {
  const updatePuzzle = useUpdatePuzzle();
  const timer = useTimer();
  const online = useOnlineStatus();
  const status = puzzleStatus(puzzle);
  const onError = (error: Error) => toast.error(error.message);

  const action = {
    wishlist: {
      label: 'I bought it',
      icon: PackageIcon,
      run: () =>
        updatePuzzle.mutate(
          { id: puzzle.id, patch: { status: 'owned' } },
          { onSuccess: () => toast.success('Moved to owned'), onError },
        ),
    },
    // Starting the timer also marks the puzzle in progress and records the start date.
    owned: {
      label: 'Start puzzle',
      icon: PlayIcon,
      run: () =>
        timer.mutate(
          { id: puzzle.id, action: 'start' },
          { onSuccess: () => toast.success('Timer started. Have fun!'), onError },
        ),
    },
    // The API stops a running timer when the puzzle is marked done.
    in_progress: {
      label: 'Mark as done',
      icon: CircleCheckBigIcon,
      run: () =>
        updatePuzzle.mutate(
          { id: puzzle.id, patch: { status: 'done', completedAt: today() } },
          { onSuccess: () => toast.success('Nice work! 🧩'), onError },
        ),
    },
    done: undefined,
  }[status];
  if (!action) return null;

  const pending = updatePuzzle.isPending || timer.isPending;
  const Icon = pending ? Loader2Icon : action.icon;
  return (
    <Button
      className="w-full"
      variant={status === 'in_progress' ? 'outline' : 'default'}
      // The timer needs the API's clock, so starting one needs a connection.
      disabled={pending || (status === 'owned' && !online)}
      onClick={action.run}
    >
      <Icon className={pending ? 'animate-spin' : undefined} aria-hidden />
      {action.label}
    </Button>
  );
}

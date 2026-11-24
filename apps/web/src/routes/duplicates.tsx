import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Loader2Icon, ScanSearchIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
import { puzzlesQueryOptions, useApi, useDeletePuzzle } from '@/api/queries';
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
import { Card, CardContent } from '@/components/ui/card';
import { fingerprintSavedPhotos, needingFingerprints } from '@/features/import/fingerprintSaved';
import { formatDate, puzzleSubtitle } from '@/features/puzzles/format';
import { PuzzlePhoto } from '@/features/puzzles/PuzzleCard';
import { findDuplicateGroups, pairKey, type DuplicateGroup } from '@/lib/duplicates';
import { STATUS_INFO } from '@/lib/status';

export const Route = createFileRoute('/duplicates')({
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData({ ...puzzlesQueryOptions(api), revalidateIfStale: true }),
  component: DuplicatesPage,
});

/**
 * Pairs marked "not duplicates" are remembered on this device. They're only a convenience:
 * if they're lost (another phone, cleared site data), those pairs are simply shown again.
 */
const DISMISSED_KEY = 'puzzle-log:not-duplicates';

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(pairs: ReadonlySet<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...pairs]));
  } catch {
    // storage unavailable: the pairs just show again next time
  }
}

const REASON_LABELS = { photo: 'Same photo', title: 'Same title' } as const;

/** Puzzles that are probably logged twice, side by side, to keep one. */
function DuplicatesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [checked, setChecked] = useState(0);
  const unchecked = needingFingerprints(puzzles);
  const groups = findDuplicateGroups(puzzles, dismissed);

  const check = useMutation({
    mutationFn: () => {
      setChecked(0);
      return fingerprintSavedPhotos(api, queryClient, unchecked, () => setChecked((n) => n + 1));
    },
  });

  function notDuplicates(group: DuplicateGroup) {
    const next = new Set(dismissed);
    group.puzzles.forEach((a, i) =>
      group.puzzles.slice(i + 1).forEach((b) => next.add(pairKey(a.id, b.id))),
    );
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Puzzles with nearly identical photos or the same title. Delete the extra copy, or mark
          them as different puzzles.
        </p>
      </div>

      {unchecked.length > 0 && (
        <div className="space-y-2 rounded-xl border p-3 text-sm">
          <p>
            {unchecked.length} {unchecked.length === 1 ? 'photo hasn’t' : 'photos haven’t'} been
            checked yet, so their duplicates can't be found by photo.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={check.isPending}
            onClick={() => check.mutate()}
          >
            {check.isPending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <ScanSearchIcon aria-hidden />
            )}
            {check.isPending ? `Checking ${checked} of ${unchecked.length}` : 'Check them now'}
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No duplicates found. 🧩</p>
      ) : (
        <ul className="space-y-3" aria-label="Possible duplicates">
          {groups.map((group) => (
            <li key={group.key}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {group.reasons.map((reason) => (
                      <Badge key={reason} variant="secondary">
                        {REASON_LABELS[reason]}
                      </Badge>
                    ))}
                  </div>
                  <ul className="space-y-2">
                    {group.puzzles.map((puzzle) => (
                      <DuplicateRow key={puzzle.id} puzzle={puzzle} />
                    ))}
                  </ul>
                  <Button size="sm" variant="ghost" onClick={() => notDuplicates(group)}>
                    Not duplicates
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DuplicateRow({ puzzle }: { puzzle: Puzzle }) {
  const deletePuzzle = useDeletePuzzle();
  const details = [
    STATUS_INFO[puzzleStatus(puzzle)].label,
    puzzleSubtitle(puzzle),
    puzzle.completedAt && `Finished ${formatDate(puzzle.completedAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-3">
      <Link to="/puzzles/$puzzleId" params={{ puzzleId: puzzle.id }} className="shrink-0">
        <PuzzlePhoto puzzle={puzzle} className="aspect-square size-20 rounded-md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/puzzles/$puzzleId"
          params={{ puzzleId: puzzle.id }}
          className="block truncate font-medium hover:underline"
        >
          {puzzle.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{details}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete “${puzzle.title}”`}
            disabled={deletePuzzle.isPending}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{puzzle.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {details}. This copy and its photo are removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deletePuzzle.mutate(puzzle.id, {
                  onSuccess: () => toast.success('Deleted'),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

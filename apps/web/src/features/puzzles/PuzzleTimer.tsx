import { Loader2Icon, PauseIcon, PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  piecesPerHour,
  puzzleStatus,
  runningMs,
  totalTimeMs,
  type Puzzle,
} from '@puzzle-log/shared';
import { useTimer } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNow } from '@/lib/useNow';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { formatClock, formatDuration } from './format';
import { SessionList } from './SessionList';

/**
 * Time spent on a puzzle, with Start / Pause while it's in progress. The running timer lives
 * on the server (as the time it started), so it keeps counting with the app closed, the phone
 * locked, or on another device; this component only redraws the clock every second.
 */
export function PuzzleTimer({ puzzle }: { puzzle: Puzzle }) {
  const running = puzzle.timerStartedAt !== undefined;
  const now = useNow(running);
  const timer = useTimer();
  const online = useOnlineStatus();
  const inProgress = puzzleStatus(puzzle) === 'in_progress';
  const sessions = puzzle.sessions ?? [];
  if (!inProgress && !running && sessions.length === 0) return null;

  const total = totalTimeMs(puzzle, now);
  const pace = piecesPerHour(puzzle.pieceCount, total);
  const action = running ? 'stop' : 'start';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time spent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p
            role="timer"
            aria-label="Total time"
            className="font-heading text-4xl font-semibold tabular-nums"
          >
            {inProgress ? formatClock(total) : formatDuration(total)}
          </p>
          {running && (
            <p className="text-sm text-muted-foreground tabular-nums">
              This session {formatClock(runningMs(puzzle, now))}
            </p>
          )}
          {pace && !running && (
            <p className="text-sm text-muted-foreground">
              About {Math.round(pace).toLocaleString()} pieces an hour
            </p>
          )}
        </div>

        {inProgress && (
          <div className="space-y-1">
            <Button
              size="lg"
              className="w-full"
              variant={running ? 'secondary' : 'default'}
              disabled={timer.isPending || !online}
              onClick={() =>
                timer.mutate(
                  { id: puzzle.id, action },
                  { onError: (error) => toast.error(error.message) },
                )
              }
            >
              {timer.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : running ? (
                <PauseIcon aria-hidden />
              ) : (
                <PlayIcon aria-hidden />
              )}
              {running ? 'Pause' : sessions.length ? 'Resume' : 'Start timer'}
            </Button>
            {!online && (
              <p className="text-center text-sm text-muted-foreground">
                The timer needs a connection.
              </p>
            )}
          </div>
        )}

        <SessionList puzzle={puzzle} />
      </CardContent>
    </Card>
  );
}

import type { Puzzle } from '@puzzle-log/shared';

/** "1,000 pieces · Ravensburger" */
export function puzzleSubtitle(puzzle: Pick<Puzzle, 'pieceCount' | 'brand'>) {
  return [puzzle.pieceCount && `${puzzle.pieceCount.toLocaleString()} pieces`, puzzle.brand]
    .filter(Boolean)
    .join(' · ');
}

/** Formats a YYYY-MM-DD date without the time-zone shift `new Date('2026-01-05')` causes. */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "2h 05m", "45m", or "under a minute": for totals. */
export function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes}m`;
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** "1:02:03" or "2:03": a running clock. */
export function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const [h, m, s] = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "Sat, Nov 21, 7:05 PM" in the user's own time zone. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

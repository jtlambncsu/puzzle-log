import type { Puzzle, TimerSession } from './puzzle.js';

export function sessionMs({ start, end }: TimerSession) {
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

/** Time on the running timer so far, or 0 when it isn't running. */
export function runningMs(puzzle: Pick<Puzzle, 'timerStartedAt'>, now = Date.now()) {
  // Clamped, in case this device's clock is a little behind the API's.
  return puzzle.timerStartedAt ? Math.max(0, now - Date.parse(puzzle.timerStartedAt)) : 0;
}

/** All the time spent on a puzzle: finished sessions plus the running timer. */
export function totalTimeMs(puzzle: Pick<Puzzle, 'sessions' | 'timerStartedAt'>, now = Date.now()) {
  const finished = (puzzle.sessions ?? []).reduce((sum, session) => sum + sessionMs(session), 0);
  return finished + runningMs(puzzle, now);
}

/** Pieces placed per hour, or undefined without both a piece count and some time. */
export function piecesPerHour(pieces: number | undefined, ms: number) {
  if (!pieces || ms < 60_000) return undefined;
  return pieces / (ms / 3_600_000);
}

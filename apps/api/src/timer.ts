import { puzzleStatus, type Puzzle } from '@puzzle-log/shared';
import type { PuzzlePatch } from './stores/types.js';

/**
 * The timer's rules, as pure functions the routes turn into conditional updates. Times come
 * from the API's clock, not the phone's, so every device agrees on when a session started.
 *
 * One rule ties the timer to the status: a timer only runs on an in-progress puzzle.
 * Starting it moves the puzzle to in progress; moving the puzzle anywhere else stops it.
 */

export function startTimerPatch(puzzle: Puzzle, now: Date, today: string): PuzzlePatch {
  return {
    timerStartedAt: now.toISOString(),
    ...(puzzleStatus(puzzle) !== 'in_progress' && { status: 'in_progress' }),
    ...(!puzzle.startedAt && { startedAt: today }),
  };
}

/**
 * Turns the running timer into a finished session. `sessions` is the list to add it to,
 * which a PATCH may be replacing at the same time.
 */
export function stopTimerPatch(
  puzzle: Puzzle & { timerStartedAt: string },
  now: Date,
  sessions = puzzle.sessions ?? [],
): PuzzlePatch {
  const end = now.toISOString();
  // A start and stop in the same millisecond is no time at all, so nothing is recorded.
  const finished = Date.parse(end) > Date.parse(puzzle.timerStartedAt);
  return {
    timerStartedAt: null,
    ...(finished && { sessions: [...sessions, { start: puzzle.timerStartedAt, end }] }),
  };
}

export function isTimerRunning(puzzle: Puzzle): puzzle is Puzzle & { timerStartedAt: string } {
  return puzzle.timerStartedAt !== undefined;
}

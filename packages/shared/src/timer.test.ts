import { describe, expect, it } from 'vitest';
import { piecesPerHour, runningMs, totalTimeMs } from './timer.js';

const hour = 3_600_000;

describe('timer totals', () => {
  it('adds finished sessions and the running timer', () => {
    const now = Date.parse('2026-11-21T12:30:00Z');
    const puzzle = {
      sessions: [
        { start: '2026-11-20T10:00:00Z', end: '2026-11-20T11:00:00Z' },
        { start: '2026-11-21T09:00:00.000Z', end: '2026-11-21T09:30:00.000Z' },
      ],
      timerStartedAt: '2026-11-21T12:00:00Z',
    };
    expect(runningMs(puzzle, now)).toBe(hour / 2);
    expect(totalTimeMs(puzzle, now)).toBe(2 * hour);
    expect(totalTimeMs({}, now)).toBe(0);
  });

  it("doesn't count backwards when this device's clock is behind", () => {
    expect(
      runningMs({ timerStartedAt: '2026-11-21T12:00:05Z' }, Date.parse('2026-11-21T12:00:00Z')),
    ).toBe(0);
  });

  it('works out pieces per hour', () => {
    expect(piecesPerHour(1000, 4 * hour)).toBe(250);
    expect(piecesPerHour(undefined, hour)).toBeUndefined();
    expect(piecesPerHour(1000, 0)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './mapWithConcurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  it('runs every item, never more than the limit at once', async () => {
    let running = 0;
    let maxRunning = 0;
    const done: number[] = [];

    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await tick();
      done.push(n);
      running--;
    });

    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(maxRunning).toBe(3);
  });

  it('handles an empty list', async () => {
    await expect(mapWithConcurrency([], 3, async () => {})).resolves.toBeUndefined();
  });
});

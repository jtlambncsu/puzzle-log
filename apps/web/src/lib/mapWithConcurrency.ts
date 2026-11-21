/**
 * Runs `task` for every item, at most `limit` at a time, and resolves when all have settled.
 * Tasks handle their own errors (one failure doesn't stop the others).
 *
 * Like `Promise.all`, but bounded: uploading 30 photos at once would saturate a phone's
 * connection and make every upload slow, while one at a time leaves bandwidth unused.
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++]!; // safe: JS is single-threaded between awaits
      await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

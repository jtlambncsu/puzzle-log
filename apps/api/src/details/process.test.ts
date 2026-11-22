import { describe, expect, it, vi } from 'vitest';
import type { DetailsJob } from '@puzzle-log/shared';
import { LookupUnavailableError } from '../barcodes/upcitemdb.js';
import { InMemoryPuzzleStore } from '../stores/memory.js';
import { InMemoryDetailsJobStore } from './jobStores.js';
import { checkBarcode, namesMatch, processJob } from './process.js';
import type { DetailsFinder, DetailsResult } from './types.js';

describe('namesMatch', () => {
  it('matches the same puzzle described differently, not other products', () => {
    expect(namesMatch('Ravensburger Disney Castle 1000 Piece Jigsaw', 'Disney Castle')).toBe(true);
    expect(namesMatch('Hogwarts at Night Puzzle', 'Hogwarts Castle')).toBe(true);
    expect(namesMatch('Garden Hose 50ft', 'Disney Castle')).toBe(false);
    expect(namesMatch('1000 Piece Puzzle', 'Another 1000 Piece Puzzle')).toBe(false);
  });
});

describe('checkBarcode', () => {
  const proposal = { title: 'Disney Castle', barcode: '4005556165001', tags: [], sources: [] };

  it('confirms, flags or leaves unverified', async () => {
    const product = (title: string) => async () => ({ title });
    expect(await checkBarcode(proposal, 'x', product('Disney Castle 1000pc'))).toBe('confirmed');
    expect(await checkBarcode(proposal, 'x', product('Garden Hose'))).toBe('mismatch');
    expect(await checkBarcode(proposal, 'x', async () => undefined)).toBe('unverified');
    const down = async () => {
      throw new LookupUnavailableError('down');
    };
    expect(await checkBarcode(proposal, 'x', down)).toBe('unverified');
    expect(await checkBarcode({ ...proposal, barcode: undefined }, 'x', down)).toBeUndefined();
  });
});

describe('processJob', () => {
  async function setup(done: boolean, results: (ids: string[]) => DetailsResult[]) {
    const puzzles = new InMemoryPuzzleStore();
    const ids: string[] = [];
    for (const title of ['Castle', 'Unknown', 'Broken']) {
      ids.push((await puzzles.create('u1', { title, imageKey: 'uploads/u1/x' })).id);
    }
    const finder: DetailsFinder = {
      start: vi.fn(),
      isDone: async () => done,
      async *results() {
        yield* results(ids);
      },
    };
    const jobs = new InMemoryDetailsJobStore();
    const job: DetailsJob = {
      id: 'batch_1',
      userId: 'u1',
      puzzleIds: ids,
      createdAt: '2026-11-22T00:00:00Z',
      status: 'processing',
      processedIds: [],
    };
    let now = Date.parse('2026-11-22T01:00:00Z');
    const deps = {
      finder,
      jobs,
      puzzles,
      findProduct: async () => ({ title: 'Disney Castle 1000 pieces' }),
      now: () => new Date((now += 1000)),
    };
    return { ids, job, deps, puzzles };
  }

  const outcomes = (ids: string[]): DetailsResult[] => [
    {
      puzzleId: ids[0]!,
      outcome: {
        status: 'found',
        proposal: { title: 'Disney Castle', barcode: '4005556165001', tags: [], sources: [] },
      },
      costUsd: 0.05,
    },
    { puzzleId: ids[1]!, outcome: { status: 'not_found' }, costUsd: 0.04 },
    { puzzleId: ids[2]!, outcome: { status: 'failed', reason: 'errored' }, costUsd: 0 },
  ];

  it('waits for the batch to finish', async () => {
    const { job, deps } = await setup(false, outcomes);
    expect(await processJob(job, deps, Infinity)).toBe(job);
  });

  it('saves proposals, remembers what was searched, and sums up', async () => {
    const { ids, job, deps, puzzles } = await setup(true, outcomes);

    const done = await processJob(job, deps, Infinity);

    expect(done).toMatchObject({
      status: 'done',
      summary: { found: 1, notFound: 1, failed: 1, costUsd: 0.09 },
    });
    const [found, notFound, failed] = await Promise.all(ids.map((id) => puzzles.get('u1', id)));
    expect(found?.details?.proposal).toMatchObject({
      title: 'Disney Castle',
      barcodeCheck: 'confirmed',
    });
    expect(found?.detailsSearchedAt).toBeDefined();
    expect(notFound?.details).toBeUndefined();
    expect(notFound?.detailsSearchedAt).toBeDefined();
    // Failed searches can be tried again.
    expect(failed?.detailsSearchedAt).toBeUndefined();
    expect(await deps.jobs.list('u1')).toEqual([done]);
  });

  it('stops at the deadline and carries on next time', async () => {
    const { job, deps } = await setup(true, outcomes);
    // Each call to now() moves the clock a second; allow about one result.
    const deadline = Date.parse('2026-11-22T01:00:03Z');

    const partial = await processJob(job, deps, deadline);
    expect(partial.status).toBe('processing');
    expect(partial.processedIds.length).toBeGreaterThan(0);
    expect(partial.processedIds.length).toBeLessThan(3);

    const finished = await processJob(partial, deps, Infinity);
    expect(finished).toMatchObject({
      status: 'done',
      summary: { found: 1, notFound: 1, failed: 1 },
    });
  });
});

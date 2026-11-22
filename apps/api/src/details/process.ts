import type { BarcodeCheck, DetailsJob, DetailsProposal, ProductInfo } from '@puzzle-log/shared';
import { LookupUnavailableError } from '../barcodes/upcitemdb.js';
import type { PuzzleStore } from '../stores/types.js';
import type { DetailsFinder, DetailsJobStore } from './types.js';

/** Words that say nothing about which puzzle it is. */
const FILLER = new Set(['puzzle', 'jigsaw', 'piece', 'pieces', 'pc', 'pcs', 'the', 'and', 'for']);

function words(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !FILLER.has(word) && !/^\d+$/.test(word)),
  );
}

/**
 * Whether a barcode database's product name plausibly describes the same puzzle: at least
 * two shared words, or half the words of the shorter name. Generous on purpose: listings
 * phrase names differently, and a real mismatch (another product entirely) shares almost
 * nothing.
 */
export function namesMatch(a: string, b: string) {
  const [x, y] = [words(a), words(b)];
  const shared = [...x].filter((word) => y.has(word)).length;
  return shared >= 2 || (shared > 0 && shared >= Math.min(x.size, y.size) / 2);
}

/** Checks a found barcode against the barcode database. */
export async function checkBarcode(
  proposal: Omit<DetailsProposal, 'barcodeCheck'>,
  currentTitle: string,
  findProduct: (barcode: string) => Promise<ProductInfo | undefined>,
): Promise<BarcodeCheck | undefined> {
  if (!proposal.barcode) return undefined;
  let product: ProductInfo | undefined;
  try {
    product = await findProduct(proposal.barcode);
  } catch (error) {
    if (error instanceof LookupUnavailableError) return 'unverified';
    throw error;
  }
  if (!product) return 'unverified';
  const names = [proposal.title, currentTitle].filter((name): name is string => !!name);
  return names.some((name) => namesMatch(product.title, name)) ? 'confirmed' : 'mismatch';
}

export interface ProcessDeps {
  finder: DetailsFinder;
  jobs: DetailsJobStore;
  puzzles: PuzzleStore;
  findProduct: (barcode: string) => Promise<ProductInfo | undefined>;
  now: () => Date;
}

/**
 * Saves a finished batch's results onto the puzzles, as proposals for the user to review.
 * Stops at `deadline` (a Lambda request must finish within 30 seconds) and records what it
 * saved, so the next call carries on where this one stopped.
 */
export async function processJob(
  job: DetailsJob,
  deps: ProcessDeps,
  deadline: number,
): Promise<DetailsJob> {
  if (job.status === 'done' || !(await deps.finder.isDone(job.id))) return job;

  const processed = new Set(job.processedIds);
  const summary = { ...(job.summary ?? { found: 0, notFound: 0, failed: 0, costUsd: 0 }) };
  let outOfTime = false;

  for await (const result of deps.finder.results(job.id)) {
    if (processed.has(result.puzzleId)) continue;
    if (deps.now().getTime() > deadline) {
      outOfTime = true;
      break;
    }
    const { outcome } = result;
    const puzzle = await deps.puzzles.get(job.userId, result.puzzleId);
    if (puzzle && outcome.status === 'found') {
      const barcodeCheck = await checkBarcode(outcome.proposal, puzzle.title, deps.findProduct);
      await deps.puzzles.update(job.userId, puzzle.id, {
        details: {
          proposal: { ...outcome.proposal, ...(barcodeCheck && { barcodeCheck }) },
          foundAt: deps.now().toISOString(),
        },
        detailsSearchedAt: deps.now().toISOString(),
      });
    } else if (puzzle && outcome.status === 'not_found') {
      // Remembered, so it isn't searched (and paid for) again.
      await deps.puzzles.update(job.userId, puzzle.id, {
        detailsSearchedAt: deps.now().toISOString(),
      });
    } else if (outcome.status === 'failed') {
      console.warn(`Details search failed for ${result.puzzleId}: ${outcome.reason}`);
    }
    summary[
      outcome.status === 'found' ? 'found' : outcome.status === 'not_found' ? 'notFound' : 'failed'
    ]++;
    summary.costUsd += result.costUsd;
    processed.add(result.puzzleId);
  }

  const updated: DetailsJob = {
    ...job,
    processedIds: [...processed],
    summary,
    status: outOfTime ? 'processing' : 'done',
  };
  await deps.jobs.put(updated);
  return updated;
}

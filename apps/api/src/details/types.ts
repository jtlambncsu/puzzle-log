import type { DetailsJob, DetailsProposal } from '@puzzle-log/shared';

/** What we know about a puzzle, sent to the search along with its photo. */
export interface DetailsRequest {
  puzzleId: string;
  title: string;
  brand?: string;
  pieceCount?: number;
  /** The user's tags, so suggested tags reuse their spelling. */
  knownTags: string[];
  photo: { bytes: Uint8Array; contentType: string };
}

export type DetailsOutcome =
  | { status: 'found'; proposal: Omit<DetailsProposal, 'barcodeCheck'> }
  | { status: 'not_found' }
  /** Didn't finish (an API error, a refusal, ran out of steps): worth trying again. */
  | { status: 'failed'; reason: string };

export interface DetailsResult {
  puzzleId: string;
  outcome: DetailsOutcome;
  /** Estimated from the tokens and searches this request used. */
  costUsd: number;
}

/**
 * Searches the web for puzzles' published details, as an asynchronous batch: start it,
 * check back later, then read the results.
 */
export interface DetailsFinder {
  /** Starts a batch and returns its id. */
  start(requests: DetailsRequest[]): Promise<string>;
  isDone(batchId: string): Promise<boolean>;
  results(batchId: string): AsyncIterable<DetailsResult>;
}

/** The search service can't be reached (no key, a network error...). */
export class DetailsUnavailableError extends Error {}

export interface DetailsJobStore {
  /** The user's jobs, newest first. */
  list(userId: string): Promise<DetailsJob[]>;
  put(job: DetailsJob): Promise<void>;
}

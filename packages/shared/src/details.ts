import { z } from 'zod';

/**
 * "Find details online": AI searches the web for a puzzle's official title, brand, piece
 * count and barcode, and proposes them. Nothing changes until the user applies a proposal.
 */

/** Most puzzles one batch request may contain (photos make requests large). */
export const MAX_DETAILS_BATCH = 10;

/** How a proposed barcode compares with what the barcode database says it is. */
export type BarcodeCheck =
  /** The barcode database knows it, under a matching name. */
  | 'confirmed'
  /** The barcode database knows it as a different product: don't trust it. */
  | 'mismatch'
  /** The barcode database doesn't know it, or couldn't be asked. */
  | 'unverified';

export interface DetailsProposal {
  title?: string;
  brand?: string;
  pieceCount?: number;
  /** Normalized to 13 digits. */
  barcode?: string;
  barcodeCheck?: BarcodeCheck;
  /** Tags to add, e.g. the artist or the series. */
  tags: string[];
  /** Pages the details came from. */
  sources: string[];
  /** Anything the user should know, e.g. "two editions exist". */
  note?: string;
}

/** A proposal waiting on the puzzle for the user to apply or dismiss. */
export interface PuzzleDetails {
  proposal: DetailsProposal;
  foundAt: string;
}

export const createDetailsJobSchema = z.object({
  puzzleIds: z.array(z.string().min(1)).min(1).max(MAX_DETAILS_BATCH),
});

export type CreateDetailsJobInput = z.infer<typeof createDetailsJobSchema>;

export interface DetailsJobSummary {
  found: number;
  notFound: number;
  /** Couldn't finish (an error, or the search ran out of steps): can be tried again. */
  failed: number;
  /** Estimated from the tokens and searches the batch used. */
  costUsd: number;
}

/** One batch of puzzles sent to the Message Batches API. */
export interface DetailsJob {
  /** The Anthropic batch id. */
  id: string;
  userId: string;
  puzzleIds: string[];
  createdAt: string;
  status: 'processing' | 'done';
  /** Results saved so far (results are saved in chunks, so a large batch can resume). */
  processedIds: string[];
  summary?: DetailsJobSummary;
}

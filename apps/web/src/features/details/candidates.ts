import {
  MAX_TAGS,
  uniqueTags,
  type DetailsJob,
  type DetailsProposal,
  type Puzzle,
  type UpdatePuzzleInput,
} from '@puzzle-log/shared';

/**
 * Puzzles worth searching for: they have a photo, have been reviewed (an imported puzzle
 * still waiting for review has only a guessed title), haven't been searched before, and
 * aren't in a batch that's still running. Missing a barcode first (what scanning needs),
 * then missing a brand or piece count, then oldest first.
 */
export function detailsCandidates(puzzles: readonly Puzzle[], jobs: readonly DetailsJob[]) {
  const running = new Set(
    jobs.filter((job) => job.status === 'processing').flatMap((job) => job.puzzleIds),
  );
  const missing = (p: Puzzle) => (p.barcode ? 0 : 2) + (p.brand && p.pieceCount ? 0 : 1);
  return puzzles
    .filter(
      (p) =>
        p.imageKey && !p.needsReview && !p.detailsSearchedAt && !p.details && !running.has(p.id),
    )
    .sort((a, b) => missing(b) - missing(a) || a.createdAt.localeCompare(b.createdAt));
}

export type ProposalField = 'title' | 'brand' | 'pieceCount' | 'barcode' | 'tags';

/** Fields where the proposal adds or changes something. */
export function changedFields(puzzle: Puzzle, proposal: DetailsProposal): ProposalField[] {
  const fields: ProposalField[] = [];
  if (proposal.title && proposal.title !== puzzle.title) fields.push('title');
  if (proposal.brand && proposal.brand !== puzzle.brand) fields.push('brand');
  if (proposal.pieceCount && proposal.pieceCount !== puzzle.pieceCount) fields.push('pieceCount');
  if (proposal.barcode && proposal.barcode !== puzzle.barcode) fields.push('barcode');
  if (newTags(puzzle, proposal).length) fields.push('tags');
  return fields;
}

export function newTags(puzzle: Puzzle, proposal: DetailsProposal) {
  const have = new Set((puzzle.tags ?? []).map((tag) => tag.toLocaleLowerCase()));
  return proposal.tags.filter((tag) => !have.has(tag.toLocaleLowerCase()));
}

/** Fields ticked by default: everything changed, except a barcode the database disputes. */
export function defaultSelection(puzzle: Puzzle, proposal: DetailsProposal) {
  return new Set(
    changedFields(puzzle, proposal).filter(
      (field) => !(field === 'barcode' && proposal.barcodeCheck === 'mismatch'),
    ),
  );
}

/** The patch that applies the chosen fields and removes the proposal. */
export function applyPatch(
  puzzle: Puzzle,
  proposal: DetailsProposal,
  chosen: ReadonlySet<ProposalField>,
): UpdatePuzzleInput {
  return {
    ...(chosen.has('title') && proposal.title && { title: proposal.title }),
    ...(chosen.has('brand') && proposal.brand && { brand: proposal.brand }),
    ...(chosen.has('pieceCount') && proposal.pieceCount && { pieceCount: proposal.pieceCount }),
    ...(chosen.has('barcode') && proposal.barcode && { barcode: proposal.barcode }),
    ...(chosen.has('tags') && {
      tags: uniqueTags([...(puzzle.tags ?? []), ...proposal.tags]).slice(0, MAX_TAGS),
    }),
    details: null,
  };
}

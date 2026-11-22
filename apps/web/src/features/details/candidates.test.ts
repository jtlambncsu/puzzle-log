import { describe, expect, it } from 'vitest';
import type { DetailsJob, DetailsProposal, Puzzle } from '@puzzle-log/shared';
import { applyPatch, changedFields, defaultSelection, detailsCandidates } from './candidates';

const puzzle = (id: string, extra: Partial<Puzzle> = {}): Puzzle => ({
  id,
  userId: 'u',
  title: id,
  createdAt: `2026-01-0${id.length}`,
  imageKey: 'uploads/u/x',
  ...extra,
});

describe('detailsCandidates', () => {
  it('skips puzzles without a photo, unreviewed, searched or in a running batch', () => {
    const puzzles = [
      puzzle('a'),
      puzzle('nophoto', { imageKey: undefined }),
      puzzle('unreviewed', { needsReview: true }),
      puzzle('searched', { detailsSearchedAt: '2026-01-01' }),
      puzzle('running'),
    ];
    const jobs = [{ status: 'processing', puzzleIds: ['running'] } as DetailsJob];
    expect(detailsCandidates(puzzles, jobs).map((p) => p.id)).toEqual(['a']);
  });

  it('puts puzzles missing a barcode first', () => {
    const puzzles = [
      puzzle('hasbarcode', { barcode: '4005556165001', brand: 'X', pieceCount: 500 }),
      puzzle('bare'),
    ];
    expect(detailsCandidates(puzzles, []).map((p) => p.id)).toEqual(['bare', 'hasbarcode']);
  });
});

describe('applying a proposal', () => {
  const saved = puzzle('p', { title: 'Castle', tags: ['Disney'], brand: 'Ravensburger' });
  const proposal: DetailsProposal = {
    title: 'Disney Castle',
    brand: 'Ravensburger',
    pieceCount: 1000,
    barcode: '4005556165001',
    barcodeCheck: 'mismatch',
    tags: ['disney', 'Thomas Kinkade'],
    sources: [],
  };

  it('lists what changes, and leaves a disputed barcode unticked', () => {
    expect(changedFields(saved, proposal)).toEqual(['title', 'pieceCount', 'barcode', 'tags']);
    expect([...defaultSelection(saved, proposal)]).toEqual(['title', 'pieceCount', 'tags']);
  });

  it('patches only the chosen fields, adds tags, and removes the proposal', () => {
    expect(applyPatch(saved, proposal, new Set(['pieceCount', 'tags']))).toEqual({
      pieceCount: 1000,
      tags: ['Disney', 'Thomas Kinkade'],
      details: null,
    });
  });
});

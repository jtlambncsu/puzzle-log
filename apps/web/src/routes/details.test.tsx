import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

const photo = { imageKey: 'uploads/test-user/p', imageUrl: 'https://photos.s3.example/p.jpg' };

describe('find details online', () => {
  it('starts with a trial of 10, in one batch', async () => {
    for (let i = 0; i < 12; i++) db.add({ title: `Puzzle ${i}`, ...photo });
    db.add({ title: 'No photo' });
    db.add({ title: 'Imported puzzle', needsReview: true, ...photo });
    const user = userEvent.setup();
    renderApp('/details');

    expect(await screen.findByText('12 puzzles to search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try 10' }));

    await waitFor(() => expect(db.detailsJobs).toHaveLength(1));
    expect(db.detailsJobs[0]!.puzzleIds).toHaveLength(10);
    expect(
      await screen.findByText(/Searching for 10 puzzles. You can leave this page/),
    ).toBeInTheDocument();
    // The ones being searched aren't offered again.
    expect(screen.getByText('2 puzzles to search')).toBeInTheDocument();
  });

  it('offers bigger runs priced on what the trial cost', async () => {
    for (let i = 0; i < 60; i++) db.add({ title: `Puzzle ${i}`, ...photo });
    db.detailsJobs.push({
      id: 'batch_0',
      userId: 'test-user',
      puzzleIds: ['a', 'b'],
      processedIds: ['a', 'b'],
      createdAt: '2026-11-22T00:00:00Z',
      status: 'done',
      summary: { found: 1, notFound: 1, failed: 0, costUsd: 0.12 },
    });
    renderApp('/details');

    expect(await screen.findByText(/1 of 2 found, about 6¢ a puzzle/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search 50 \(about \$3.00\)/ })).toBeInTheDocument();
    expect(screen.getByText(/2 puzzles, 1 found, 1 not found, about \$0.12/)).toBeInTheDocument();
  });

  it('applies the chosen fields of a proposal, from the home page banner', async () => {
    const puzzle = db.add({
      title: 'Castle',
      tags: ['Disney'],
      ...photo,
      details: {
        foundAt: '2026-11-22T00:00:00Z',
        proposal: {
          title: 'Disney Dreams Castle',
          pieceCount: 1000,
          barcode: '4005556165001',
          barcodeCheck: 'mismatch',
          tags: ['Thomas Kinkade'],
          sources: ['https://www.ravensburger.com/castle'],
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: /Details found for 1 puzzle/ }));
    const changes = await screen.findByRole('list', { name: 'Proposed changes' });
    // A barcode the database disputes starts unticked, with a warning.
    expect(within(changes).getByRole('checkbox', { name: /Barcode/ })).not.toBeChecked();
    expect(within(changes).getByText(/lists a different product/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ravensburger.com/ })).toHaveAttribute(
      'href',
      'https://www.ravensburger.com/castle',
    );
    await user.click(within(changes).getByRole('checkbox', { name: /Title/ }));
    await user.click(screen.getByRole('button', { name: 'Apply selected' }));

    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.details).toBeUndefined());
    expect(db.puzzles.get(puzzle.id)).toMatchObject({
      title: 'Castle',
      pieceCount: 1000,
      tags: ['Disney', 'Thomas Kinkade'],
    });
    expect(db.puzzles.get(puzzle.id)?.barcode).toBeUndefined();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IMPORTED_TITLE } from '@puzzle-log/shared';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

// jsdom can't decode images, so photos pass through unchanged (see routes.test.tsx).
vi.mock('@/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image')>()),
  compressImage: vi.fn(async (photo: Blob) => photo),
}));

function fixturePhoto(name: string, as = name) {
  const bytes = readFileSync(join(process.env.FIXTURES_DIR!, name));
  return new File([bytes], as, { type: 'image/jpeg' });
}

describe('importing photos', () => {
  it('skips exact copies, imports one puzzle per photo for review, and skips them next time', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/import');
    const photos = [
      fixturePhoto('photo-taken-2026-11-14.jpg'),
      fixturePhoto('photo-taken-2026-11-14.jpg', 'copy.jpg'), // same bytes
      fixturePhoto('photo-no-exif.jpg'),
    ];

    await user.upload(await screen.findByLabelText('Choose photos'), photos);

    expect(await screen.findByText('3 photos → 2 puzzles')).toBeInTheDocument();
    expect(screen.getByText('1 exact copies')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import 2 puzzles' }));

    expect(await screen.findByText(/Imported 2 puzzles/)).toBeInTheDocument();
    const saved = [...db.puzzles.values()];
    expect(saved).toHaveLength(2);
    expect(saved.every((p) => p.needsReview && p.title === IMPORTED_TITLE)).toBe(true);
    expect(saved.map((p) => p.completedAt).sort()).toEqual(['2026-11-14', undefined]);
    expect(saved.every((p) => p.importHashes?.[0]?.length === 64)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Import more' }));
    await user.upload(screen.getByLabelText('Choose photos'), photos);
    expect(await screen.findByText('3 photos → 0 puzzles')).toBeInTheDocument();
    expect(screen.getByText('3 imported before')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 puzzles' })).toBeDisabled();
  });
});

describe('reviewing imports', () => {
  function addImported(title = IMPORTED_TITLE, completedAt?: string) {
    return db.add({
      title,
      status: 'done',
      needsReview: true,
      completedAt,
      importHashes: [crypto.randomUUID().replaceAll('-', '').padEnd(64, '0')],
      imageUrl: 'https://photos.s3.example/x.jpg',
    });
  }

  it("fills in AI's suggestion, saves, and merges a re-shoot into the last one", async () => {
    const first = addImported(IMPORTED_TITLE, '2024-01-01');
    const reshoot = addImported(IMPORTED_TITLE, '2024-01-02');
    db.add({ title: 'Old favorite', tags: ['Harry Potter'] });
    db.suggestions.set(first.id, { title: 'Hogwarts at Night', tags: ['Harry Potter'] });
    db.suggestions.set(reshoot.id, { title: 'Hogwarts Castle', tags: [] });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: /2 imported puzzles to review/ }));

    // The suggestion for the first arrives, and the next one is asked for ahead of time.
    expect(await screen.findByText('Suggesting a title and tags…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Hogwarts at Night'));
    expect(screen.getByText('2 left')).toBeInTheDocument();
    await waitFor(() => expect(db.suggestCalls.sort()).toEqual([first.id, reshoot.id].sort()));
    await user.type(screen.getByLabelText('Pieces'), '1000');
    await user.click(screen.getByRole('button', { name: 'Save & next' }));

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Hogwarts Castle'));
    expect(db.puzzles.get(first.id)).toMatchObject({
      title: 'Hogwarts at Night',
      pieceCount: 1000,
      tags: ['Harry Potter'],
    });
    expect(db.puzzles.get(first.id)?.needsReview).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Same puzzle as “Hogwarts at Night”/ }));

    expect(await screen.findByText('All caught up! 🧩')).toBeInTheDocument();
    expect(db.puzzles.has(reshoot.id)).toBe(false);
    expect(db.puzzles.get(first.id)?.importHashes).toEqual([
      ...first.importHashes!,
      ...reshoot.importHashes!,
    ]);
  });

  it('lets you type a title when no suggestion comes, and skip or delete', async () => {
    const failed = addImported(IMPORTED_TITLE, '2024-01-01');
    const notAPuzzle = addImported('Cat on a Sofa', '2024-01-02');
    const user = userEvent.setup();
    renderApp('/review');

    expect(await screen.findByText(/Couldn't suggest a title/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save & next' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByLabelText('Title')).toHaveValue('Cat on a Sofa');
    await user.click(screen.getByRole('button', { name: 'Not a puzzle' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('You skipped 1.')).toBeInTheDocument();
    expect(db.puzzles.has(notAPuzzle.id)).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Go through the skipped ones' }));
    expect(await screen.findByText(/Couldn't suggest a title/)).toBeInTheDocument();
    expect(db.puzzles.get(failed.id)?.needsReview).toBe(true);
  });
});

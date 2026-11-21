import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { db, server } from '@/test/server';
import { renderApp } from '@/test/renderApp';

describe('puzzle list', () => {
  it('shows puzzles with their details', async () => {
    db.add({ title: 'Starry Night', pieceCount: 1000, brand: 'Ravensburger' });
    renderApp('/');

    expect(await screen.findByText('Starry Night')).toBeInTheDocument();
    expect(screen.getByText('1,000 pieces · Ravensburger')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your puzzles/i })).toHaveTextContent('(1)');
  });

  it('invites you to add a first puzzle', async () => {
    renderApp('/');
    expect(await screen.findByText('No puzzles yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add your first puzzle/i })).toHaveAttribute(
      'href',
      '/puzzles/new',
    );
  });

  it('shows an error with a retry button', async () => {
    server.use(http.get('/api/puzzles', () => HttpResponse.json({}, { status: 500 })));
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed: 500');

    server.resetHandlers();
    db.add({ title: 'Back again' });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Back again')).toBeInTheDocument();
  });
});

describe('adding a puzzle', () => {
  it('requires a title and a whole number of pieces', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Pieces'), '12.5');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(db.puzzles.size).toBe(0);
  });

  it('saves the puzzle and returns to the list', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Title'), 'Starry Night');
    await user.type(screen.getByLabelText('Pieces'), '1000');
    await user.type(screen.getByLabelText('Brand'), '  Ravensburger ');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Starry Night')).toBeInTheDocument();
    expect([...db.puzzles.values()][0]).toMatchObject({
      title: 'Starry Night',
      pieceCount: 1000,
      brand: 'Ravensburger',
    });
  });

  it('uploads the photo to S3 before saving', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    const photo = new File(['fake image bytes'], 'puzzle.jpg', { type: 'image/jpeg' });
    await user.upload(await screen.findByLabelText('Photo'), photo);
    expect(screen.getByAltText('Selected puzzle photo')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'With photo');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    await waitFor(() => expect(db.puzzles.size).toBe(1));
    const upload = db.uploads[0]!;
    expect(upload.get('key')).toBe('uploads/test-user/photo-1');
    // (The Blob comes from Node's fetch, not jsdom, so check its shape, not `instanceof`.)
    expect(upload.get('file')).toMatchObject({ size: photo.size, type: 'image/jpeg' });
    expect([...db.puzzles.values()][0]?.imageKey).toBe('uploads/test-user/photo-1');
  });

  it('keeps the form and explains when saving fails', async () => {
    server.use(http.post('/api/puzzles', () => HttpResponse.json({}, { status: 500 })));
    const user = userEvent.setup();
    const { router } = renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Title'), 'Doomed');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    expect(await screen.findByText('Request failed: 500')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/puzzles/new');
    expect(screen.getByLabelText('Title')).toHaveValue('Doomed');
  });
});

/** Small real JPEGs from `src/test/fixtures`, so the actual EXIF library runs. */
function fixturePhoto(name: string) {
  // Vitest runs from apps/web (in jsdom, import.meta.url isn't a file path).
  const bytes = readFileSync(join(process.cwd(), 'src/test/fixtures', name));
  return new File([bytes], name, { type: 'image/jpeg' });
}

describe('date from photo', () => {
  it('fills "Finished on" with the date the photo was taken', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(
      await screen.findByLabelText('Photo'),
      fixturePhoto('photo-taken-2026-11-14.jpg'),
    );

    await waitFor(() => expect(screen.getByLabelText('Finished on')).toHaveValue('2026-11-14'));
    expect(screen.getByText('Date from photo')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Dated');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));
    await waitFor(() => expect([...db.puzzles.values()][0]?.completedAt).toBe('2026-11-14'));
  });

  it("doesn't overwrite a date you already entered", async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Finished on'), '2026-01-02');
    await user.upload(screen.getByLabelText('Photo'), fixturePhoto('photo-taken-2026-11-14.jpg'));

    await screen.findByAltText('Selected puzzle photo');
    // Give the async EXIF read a chance to (not) change anything.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByLabelText('Finished on')).toHaveValue('2026-01-02');
    expect(screen.queryByText('Date from photo')).not.toBeInTheDocument();
  });

  it('clears the photo date when the photo is removed', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(
      await screen.findByLabelText('Photo'),
      fixturePhoto('photo-taken-2026-11-14.jpg'),
    );
    await waitFor(() => expect(screen.getByLabelText('Finished on')).toHaveValue('2026-11-14'));

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.getByLabelText('Finished on')).toHaveValue('');
  });

  it('leaves the date empty for photos without one', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(await screen.findByLabelText('Photo'), fixturePhoto('photo-no-exif.jpg'));

    await screen.findByAltText('Selected puzzle photo');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByLabelText('Finished on')).toHaveValue('');
  });
});

describe('bulk add', () => {
  async function pickPhotos(user: ReturnType<typeof userEvent.setup>) {
    await user.upload(await screen.findByLabelText('Choose photos'), [
      fixturePhoto('photo-taken-2026-11-14.jpg'),
      fixturePhoto('photo-no-exif.jpg'),
    ]);
  }

  it('saves a puzzle per photo, with dates from the photos', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/puzzles/bulk');

    await pickPhotos(user);
    await waitFor(() =>
      expect(screen.getByLabelText('Finished on for photo 1')).toHaveValue('2026-11-14'),
    );
    expect(screen.getByLabelText('Finished on for photo 2')).toHaveValue('');
    expect(screen.getByText('From photo')).toBeInTheDocument();

    // Titles are required.
    await user.click(screen.getByRole('button', { name: 'Save 2 puzzles' }));
    expect(await screen.findAllByText('Title is required')).toHaveLength(2);

    await user.type(screen.getByLabelText('Title for photo 1'), 'Starry Night');
    await user.type(screen.getByLabelText('Title for photo 2'), 'Cat Café');
    await user.type(screen.getByLabelText('Pieces for photo 2'), '300');
    await user.click(screen.getByRole('button', { name: 'Save 2 puzzles' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const saved = [...db.puzzles.values()];
    expect(saved).toHaveLength(2);
    expect(saved.find((p) => p.title === 'Starry Night')?.completedAt).toBe('2026-11-14');
    expect(saved.find((p) => p.title === 'Cat Café')?.pieceCount).toBe(300);
    expect(db.uploads).toHaveLength(2);
    expect(await screen.findByText('Starry Night')).toBeInTheDocument();
  });

  it('keeps failed rows to retry, without duplicating saved ones', async () => {
    let failCatCafe = true;
    server.use(
      http.post('/api/puzzles', async ({ request }) => {
        const body = (await request.clone().json()) as { title: string };
        if (failCatCafe && body.title === 'Cat Café') {
          return HttpResponse.json({}, { status: 500 });
        }
        return undefined; // fall through to the default handler
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/puzzles/bulk');

    await pickPhotos(user);
    await user.type(await screen.findByLabelText('Title for photo 1'), 'Starry Night');
    await user.type(screen.getByLabelText('Title for photo 2'), 'Cat Café');
    await user.click(screen.getByRole('button', { name: 'Save 2 puzzles' }));

    const puzzle2 = screen.getByRole('group', { name: 'Puzzle 2' });
    expect(await within(puzzle2).findByRole('alert')).toHaveTextContent('Request failed: 500');
    const puzzle1 = screen.getByRole('group', { name: 'Puzzle 1' });
    expect(within(puzzle1).getByText('Saved')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/puzzles/bulk');
    expect(db.puzzles.size).toBe(1);

    failCatCafe = false;
    await user.click(screen.getByRole('button', { name: 'Save 1 puzzle' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect([...db.puzzles.values()].map((p) => p.title).sort()).toEqual([
      'Cat Café',
      'Starry Night',
    ]);
  });

  it('lets you remove a photo before saving', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/bulk');

    await pickPhotos(user);
    await user.click(await screen.findByRole('button', { name: 'Remove photo 1' }));

    expect(screen.getAllByRole('group', { name: /^Puzzle \d/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save 1 puzzle' })).toBeInTheDocument();
  });
});

describe('puzzle detail', () => {
  it('shows the puzzle and deletes it after confirming', async () => {
    const puzzle = db.add({ title: 'Starry Night', notes: 'Sky was hard' });
    const user = userEvent.setup();
    const { router } = renderApp(`/puzzles/${puzzle.id}`);

    expect(await screen.findByRole('heading', { name: 'Starry Night' })).toBeInTheDocument();
    expect(screen.getByText('Sky was hard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete puzzle/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(db.puzzles.size).toBe(0);
    expect(await screen.findByText('No puzzles yet')).toBeInTheDocument();
  });

  it("shows not-found for a puzzle that doesn't exist", async () => {
    renderApp('/puzzles/nope');
    expect(await screen.findByText("That page doesn't exist.")).toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { compressImage } from '@/lib/image';
import { db, S3_URL, server } from '@/test/server';
import { renderApp } from '@/test/renderApp';

// jsdom can't decode or draw images, so pass photos through unchanged and let tests check
// which rotation was requested. (The real canvas code is checked in a browser.)
vi.mock('@/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image')>()),
  compressImage: vi.fn(async (photo: Blob) => photo),
}));

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
  const bytes = readFileSync(join(process.env.FIXTURES_DIR!, name));
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
    // The batch finishes (and the button returns) once the list cache has refreshed.
    await user.click(await screen.findByRole('button', { name: 'Save 1 puzzle' }));

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

describe('rotating photos', () => {
  it('rotates a new photo before uploading it', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(await screen.findByLabelText('Photo'), fixturePhoto('photo-no-exif.jpg'));
    await user.click(screen.getByRole('button', { name: 'Rotate photo' }));
    await user.click(screen.getByRole('button', { name: 'Rotate photo' }));
    expect(screen.getByAltText('Selected puzzle photo')).toHaveStyle({
      transform: 'rotate(180deg)',
    });

    await user.type(screen.getByLabelText('Title'), 'Upside down');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    await waitFor(() => expect(db.puzzles.size).toBe(1));
    expect(compressImage).toHaveBeenLastCalledWith(expect.anything(), { rotation: 180 });
  });

  it('rotates each bulk photo separately', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/bulk');

    await user.upload(await screen.findByLabelText('Choose photos'), [
      fixturePhoto('photo-no-exif.jpg'),
      fixturePhoto('photo-taken-2026-11-14.jpg'),
    ]);
    await user.click(screen.getByRole('button', { name: 'Rotate photo 2' }));
    await user.type(screen.getByLabelText('Title for photo 1'), 'Upright');
    await user.type(screen.getByLabelText('Title for photo 2'), 'Sideways');
    await user.click(screen.getByRole('button', { name: 'Save 2 puzzles' }));

    await waitFor(() => expect(db.puzzles.size).toBe(2));
    const rotations = vi.mocked(compressImage).mock.calls.map(([, options]) => options?.rotation);
    expect(rotations.slice(-2).sort()).toEqual([0, 90]);
  });

  it('rotates a saved photo and replaces it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const puzzle = db.add({
      title: 'Sideways',
      imageKey: 'uploads/test-user/original',
      imageUrl: 'https://photos.s3.example/uploads/test-user/original?signed',
    });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    await user.click(await screen.findByRole('button', { name: 'Rotate photo' }));
    expect(screen.getByAltText('Photo of Sideways')).toHaveStyle({ transform: 'rotate(90deg)' });
    await user.click(screen.getByRole('button', { name: 'Save rotation' }));

    expect(await screen.findByText('Photo rotated')).toBeInTheDocument();
    // The download must skip the browser cache (see downloadPhoto in queries.ts). MSW doesn't
    // expose a request's cache mode, so check what fetch was called with.
    const download = fetchSpy.mock.calls.find(([url]) =>
      String(url).startsWith(S3_URL + 'uploads'),
    );
    expect(download?.[1]).toMatchObject({ cache: 'no-store' });
    fetchSpy.mockRestore();
    expect(compressImage).toHaveBeenLastCalledWith(expect.anything(), { rotation: 90 });
    expect(db.puzzles.get(puzzle.id)?.imageKey).toBe('uploads/test-user/photo-1');
    // The new photo is already upright, so the preview rotation resets.
    expect(screen.getByAltText('Photo of Sideways')).not.toHaveStyle({
      transform: 'rotate(90deg)',
    });
    expect(screen.queryByRole('button', { name: 'Save rotation' })).not.toBeInTheDocument();
  });

  it('can cancel a rotation without saving', async () => {
    const puzzle = db.add({
      title: 'Fine as is',
      imageKey: 'uploads/test-user/original',
      imageUrl: 'https://photos.s3.example/uploads/test-user/original?signed',
    });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    await user.click(await screen.findByRole('button', { name: 'Rotate photo' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: 'Save rotation' })).not.toBeInTheDocument();
    expect(db.puzzles.get(puzzle.id)?.imageKey).toBe('uploads/test-user/original');
  });
});

describe('search and tags', () => {
  function addLibrary() {
    db.add({ title: 'Battle of Hoth', brand: 'Ravensburger', tags: ['Star Wars'] });
    db.add({ title: 'Endor Forest', pieceCount: 1000, tags: ['star wars', 'Forest'] });
    db.add({ title: 'Café Terrace', notes: 'Van Gogh' });
  }

  it('finds puzzles as you type and keeps the search in the URL', async () => {
    addLibrary();
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.type(await screen.findByLabelText('Search puzzles'), 'cafe');

    expect(screen.getByText('Café Terrace')).toBeInTheDocument();
    expect(screen.queryByText('Battle of Hoth')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your puzzles/i })).toHaveTextContent('(1 of 3)');
    expect(router.state.location.search).toEqual({ q: 'cafe' });

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Battle of Hoth')).toBeInTheDocument();
  });

  it('searches piece counts too', async () => {
    addLibrary();
    renderApp('/?q=1000');
    // Typing "1000" and reloading must still work (the URL parser reads it as a number).
    expect(await screen.findByText('Endor Forest')).toBeInTheDocument();
    expect(screen.queryByText('Battle of Hoth')).not.toBeInTheDocument();
  });

  it('filters by a tag chip, merging different capitalizations', async () => {
    addLibrary();
    const user = userEvent.setup();
    renderApp('/');

    const chip = await screen.findByRole('button', { name: 'Star Wars, 2 puzzles' });
    await user.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Battle of Hoth')).toBeInTheDocument();
    expect(screen.getByText('Endor Forest')).toBeInTheDocument();
    expect(screen.queryByText('Café Terrace')).not.toBeInTheDocument();

    await user.click(chip); // tapping again clears it
    expect(screen.getByText('Café Terrace')).toBeInTheDocument();
  });

  it('explains when nothing matches', async () => {
    addLibrary();
    const user = userEvent.setup();
    renderApp('/?tag=Forest');

    await user.type(await screen.findByLabelText('Search puzzles'), 'hoth');
    expect(screen.getByText(/No puzzles match “hoth” tagged “Forest”/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('links tags on a puzzle to the filtered list', async () => {
    const hoth = db.add({ title: 'Battle of Hoth', tags: ['Star Wars'] });
    db.add({ title: 'Not Star Wars' });
    const user = userEvent.setup();
    const { router } = renderApp(`/puzzles/${hoth.id}`);

    await user.click(await screen.findByRole('link', { name: 'Star Wars' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tag: 'Star Wars' }));
    expect(await screen.findByRole('heading', { name: /your puzzles/i })).toHaveTextContent(
      '(1 of 2)',
    );
  });

  it('adds tags with Enter, commas or suggestions when creating a puzzle', async () => {
    db.add({ title: 'Existing', tags: ['Disney'] });
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Title'), 'Frozen');
    await user.type(screen.getByLabelText('Tags'), 'Snow, Winter{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Disney' }));
    // Backspace in the empty box removes the last tag.
    await user.type(screen.getByLabelText('Tags'), 'Oops{Enter}{Backspace}');
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    await waitFor(() => expect(db.puzzles.size).toBe(2));
    const frozen = [...db.puzzles.values()].find((p) => p.title === 'Frozen');
    expect(frozen?.tags).toEqual(['Snow', 'Winter', 'Disney']);
  });

  it('suggests tags that start with what you type', async () => {
    db.add({ title: 'Existing', tags: ['Movies', 'Star Wars', 'Snow'] });
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Tags'), 's');

    const suggestions = await screen.findByLabelText('Suggested tags');
    expect(
      within(suggestions)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Snow', 'Star Wars']);
  });

  it('tags every photo in a bulk add', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/bulk');

    await user.upload(await screen.findByLabelText('Choose photos'), [
      fixturePhoto('photo-no-exif.jpg'),
      fixturePhoto('photo-taken-2026-11-14.jpg'),
    ]);
    await user.type(screen.getByLabelText('Tags for all photos'), 'Star Wars{Enter}');
    await user.type(screen.getByLabelText('Title for photo 1'), 'Hoth');
    await user.type(screen.getByLabelText('Title for photo 2'), 'Endor');
    await user.click(screen.getByRole('button', { name: 'Save 2 puzzles' }));

    await waitFor(() => expect(db.puzzles.size).toBe(2));
    expect([...db.puzzles.values()].map((p) => p.tags)).toEqual([['Star Wars'], ['Star Wars']]);
  });
});

describe('editing a puzzle', () => {
  it('starts from the saved values and sends a merge patch', async () => {
    const puzzle = db.add({ title: 'Hoth', brand: 'Ravensburger', pieceCount: 1000 });
    const user = userEvent.setup();
    const { router } = renderApp(`/puzzles/${puzzle.id}`);

    await user.click(await screen.findByRole('link', { name: 'Edit' }));
    expect(await screen.findByLabelText('Title')).toHaveValue('Hoth');
    expect(screen.getByLabelText('Brand')).toHaveValue('Ravensburger');
    // Editing doesn't offer a new photo (rotation lives on the detail page).
    expect(screen.queryByText('Take or choose a photo')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Brand'));
    await user.type(screen.getByLabelText('Tags'), 'Star Wars{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/puzzles/${puzzle.id}`));
    // Blank fields are sent as null, which removes them.
    expect(db.patches.at(-1)).toEqual({
      title: 'Hoth',
      status: 'done',
      brand: null,
      pieceCount: 1000,
      startedAt: null,
      completedAt: null,
      notes: null,
      tags: ['Star Wars'],
      barcode: null,
    });
    expect(await screen.findByRole('link', { name: 'Star Wars' })).toBeInTheDocument();
    expect(screen.queryByText(/Ravensburger/)).not.toBeInTheDocument();
  });
});

describe('statuses', () => {
  it('filters the list by status and marks puzzles that are not done', async () => {
    db.add({ title: 'Finished one' });
    db.add({ title: 'On the shelf', status: 'owned' });
    db.add({ title: 'Want it', status: 'wishlist' });
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Wishlist, 1 puzzle' }));

    expect(screen.getByText('Want it')).toBeInTheDocument();
    expect(screen.queryByText('Finished one')).not.toBeInTheDocument();
    expect(router.state.location.search).toEqual({ status: 'wishlist' });
    // Old puzzles without a status count as done.
    await user.click(screen.getByRole('button', { name: 'Done, 1 puzzle' }));
    expect(screen.getByText('Finished one')).toBeInTheDocument();
  });

  it('adds a wishlist puzzle without a finished date', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.type(await screen.findByLabelText('Title'), 'Someday');
    await user.click(screen.getByRole('radio', { name: 'Wishlist' }));
    expect(screen.queryByLabelText('Finished on')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    await waitFor(() => expect(db.puzzles.size).toBe(1));
    expect([...db.puzzles.values()][0]).toMatchObject({ title: 'Someday', status: 'wishlist' });
    expect([...db.puzzles.values()][0]?.completedAt).toBeUndefined();
  });

  it('moves a puzzle along wishlist → owned → in progress → done with one tap each', async () => {
    const puzzle = db.add({ title: 'Someday', status: 'wishlist' });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);
    const today = new Date().toLocaleDateString('en-CA');

    await user.click(await screen.findByRole('button', { name: 'I bought it' }));
    await user.click(await screen.findByRole('button', { name: 'Start puzzle' }));
    // Starting runs the timer and records the start date.
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(db.puzzles.get(puzzle.id)).toMatchObject({ status: 'in_progress', startedAt: today });
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.status).toBe('done'));
    expect(db.patches).toEqual([{ status: 'owned' }, { status: 'done', completedAt: today }]);
    // Finishing stopped the timer and kept the session.
    expect(db.puzzles.get(puzzle.id)?.timerStartedAt).toBeUndefined();
    expect(db.puzzles.get(puzzle.id)?.sessions).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Mark as done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
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

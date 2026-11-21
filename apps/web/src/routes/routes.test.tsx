import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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

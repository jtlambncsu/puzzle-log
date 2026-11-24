import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

// jsdom can't decode images, so photos pass through unchanged (see routes.test.tsx).
vi.mock('@/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image')>()),
  compressImage: vi.fn(async (photo: Blob) => photo),
}));

const image = (name: string) => new File(['img'], name, { type: 'image/jpeg' });

describe('box photos', () => {
  it('adds a puzzle with only a box photo, which the list shows', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(await screen.findByLabelText('Box photo (optional)'), image('box.jpg'));
    await user.type(screen.getByLabelText('Title'), 'Someday Castle');
    await user.click(screen.getByRole('radio', { name: 'Wishlist' }));
    await user.click(screen.getByRole('button', { name: /save puzzle/i }));

    expect(await screen.findByRole('img', { name: 'Box of Someday Castle' })).toBeInTheDocument();
    const saved = [...db.puzzles.values()][0]!;
    expect(saved).toMatchObject({ boxImageKey: 'uploads/test-user/photo-1', status: 'wishlist' });
    expect(saved.imageKey).toBeUndefined();
  });

  it('adds, replaces and removes a box photo from the puzzle page', async () => {
    const puzzle = db.add({ title: 'Castle' });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    await user.click(await screen.findByRole('button', { name: 'Add box photo' }));
    await user.upload(screen.getByLabelText('Choose a photo'), image('box.jpg'));
    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.boxImageKey).toBeDefined());

    await user.click(await screen.findByRole('button', { name: 'Remove box photo' }));
    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.boxImageKey).toBeUndefined());
    expect(await screen.findByRole('button', { name: 'Add box photo' })).toBeInTheDocument();
    // No finished photo yet either: it can be added here too.
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument();
  });
});

describe('suggesting tags', () => {
  it('adds AI tags to the form, and reuses the uploaded photo when saving', async () => {
    db.tagSuggestions = ['Disney', 'Castles', 'disney'];
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    const suggest = await screen.findByRole('button', { name: 'Suggest tags' });
    expect(suggest).toBeDisabled(); // nothing to go on yet
    await user.upload(screen.getByLabelText('Box photo (optional)'), image('box.jpg'));
    await user.type(screen.getByLabelText('Title'), 'Cinderella Castle');
    await user.click(suggest);

    const tags = await screen.findByRole('list', { name: 'Chosen tags' });
    await waitFor(() => expect(within(tags).getAllByRole('listitem')).toHaveLength(2));
    expect(db.tagRequests).toEqual([
      { title: 'Cinderella Castle', imageKeys: ['uploads/test-user/photo-1'] },
    ]);

    await user.click(screen.getByRole('button', { name: /save puzzle/i }));
    await waitFor(() => expect(db.puzzles.size).toBe(1));
    expect([...db.puzzles.values()][0]).toMatchObject({
      tags: ['Disney', 'Castles'],
      boxImageKey: 'uploads/test-user/photo-1',
    });
    expect(db.uploads).toHaveLength(1); // not uploaded twice
  });

  it("uses the saved puzzle's photos when editing", async () => {
    db.tagSuggestions = ['Lighthouses'];
    const puzzle = db.add({
      title: 'Coast',
      imageKey: 'uploads/test-user/a',
      boxImageKey: 'uploads/test-user/b',
    });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Suggest tags' }));

    await waitFor(() =>
      expect(db.tagRequests).toEqual([
        { title: 'Coast', imageKeys: ['uploads/test-user/a', 'uploads/test-user/b'] },
      ]),
    );
    expect(await screen.findByText('Lighthouses')).toBeInTheDocument();
  });
});

describe('filling in from the box', () => {
  it("fills in what's printed on the box, without overwriting what was typed", async () => {
    db.boxDetails = { title: 'Paris Café', brand: 'Ravensburger', pieceCount: 1000 };
    const user = userEvent.setup();
    renderApp('/puzzles/new');

    await user.upload(await screen.findByLabelText('Box photo (optional)'), image('box.jpg'));
    await user.type(screen.getByLabelText('Brand'), 'My brand');
    await user.click(screen.getByRole('button', { name: 'Fill in from box' }));

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Paris Café'));
    expect(screen.getByLabelText('Pieces')).toHaveValue('1000');
    expect(screen.getByLabelText('Brand')).toHaveValue('My brand');
    expect(await screen.findByText('Filled in title and pieces from the box')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save puzzle/i }));
    await waitFor(() => expect(db.puzzles.size).toBe(1));
    expect([...db.puzzles.values()][0]).toMatchObject({
      title: 'Paris Café',
      pieceCount: 1000,
      boxImageKey: 'uploads/test-user/photo-1',
    });
    expect(db.uploads).toHaveLength(1); // the photo read is the one saved
  });

  it("reads the saved box when editing, and says when it can't", async () => {
    const puzzle = db.add({ title: 'Coast', boxImageKey: 'uploads/test-user/b' });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Fill in from box' }));
    expect(await screen.findByText(/service is unavailable right now/)).toBeInTheDocument();
    expect(db.boxRequests).toEqual([{ imageKey: 'uploads/test-user/b' }]);

    db.boxDetails = {};
    await user.click(screen.getByRole('button', { name: 'Fill in from box' }));
    expect(await screen.findByText(/Couldn't read the box/)).toBeInTheDocument();
  });

  it('only offers it once there is a box photo', async () => {
    renderApp('/puzzles/new');
    await screen.findByLabelText('Box photo (optional)');
    expect(screen.queryByRole('button', { name: 'Fill in from box' })).not.toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, S3_URL } from '@/test/server';
import { renderApp } from '@/test/renderApp';

/** Captures what the page saves (jsdom can't share or download for real). */
function captureSaves() {
  const saved: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved.push(blob as Blob);
    return 'blob:saved';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return saved;
}

describe('backup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is reached from the More page, and saves the log as a spreadsheet', async () => {
    db.add({ title: 'Hogwarts at Night', pieceCount: 1000, tags: ['Harry Potter'] });
    const saved = captureSaves();
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: /More/ }));
    await user.click(await screen.findByRole('link', { name: /Backup/ }));
    await user.click(await screen.findByRole('button', { name: 'Download spreadsheet' }));

    expect(saved).toHaveLength(1);
    const { data } = Papa.parse<Record<string, string>>(await saved[0]!.text(), {
      // text() drops the byte-order mark Excel needs.
      header: true,
    });
    expect(data[0]).toMatchObject({
      Title: 'Hogwarts at Night',
      Pieces: '1000',
      Tags: 'Harry Potter',
    });
  });

  it('zips photos in parts, then saves on a second tap', async () => {
    const puzzle = db.add({ title: 'Castle', imageKey: 'uploads/u/a', imageUrl: `${S3_URL}a.jpg` });
    db.add({ title: 'No photo' });
    const saved = captureSaves();
    const user = userEvent.setup();
    renderApp('/backup');

    expect(await screen.findByText('Photos 1–1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prepare' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    const files = unzipSync(new Uint8Array(await saved[0]!.arrayBuffer()));
    expect(Object.keys(files)).toEqual([`castle-${puzzle.id.slice(0, 8)}.jpg`]);
  });
});

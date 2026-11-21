import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { db, server } from '@/test/server';
import { renderApp } from '@/test/renderApp';

// The real scanner needs a camera. This stand-in "scans" when its button is pressed: first a
// misread (bad check digit, ignored), then a real UPC-A code.
vi.mock('@yudiel/react-qr-scanner', () => ({
  setZXingModuleOverrides: vi.fn(),
  Scanner: ({ onScan }: { onScan: (codes: { rawValue: string }[]) => void }) => (
    <button
      type="button"
      onClick={() => onScan([{ rawValue: '021081311145' }, { rawValue: '021081311144' }])}
    >
      Fake camera scan
    </button>
  ),
}));

const CINDERELLA = '0021081311144'; // EAN-13 form of UPC 021081311144

describe('scanning a box', () => {
  it('says "done it" for a puzzle with that barcode, without asking the lookup service', async () => {
    db.add({ title: 'Cinderella', barcode: CINDERELLA });
    const user = userEvent.setup();
    const { router } = renderApp('/scan');

    await user.click(await screen.findByRole('button', { name: 'Fake camera scan' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/scan/${CINDERELLA}`));
    expect(
      await screen.findByRole('heading', { name: "You've done this one" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cinderella')).toBeInTheDocument();
    expect(db.barcodeLookups).toEqual([]);
  });

  it.each([
    ['owned', 'You already own this one'],
    ['wishlist', "It's on your wishlist!"],
  ] as const)('warns when a %s puzzle has the barcode', async (status, heading) => {
    db.add({ title: 'Cinderella', barcode: CINDERELLA, status });
    renderApp(`/scan/${CINDERELLA}`);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('can add an unknown box to the wishlist', async () => {
    db.products.set(CINDERELLA, { title: 'Ceaco Cinderella' });
    const user = userEvent.setup();
    renderApp(`/scan/${CINDERELLA}`);

    await user.click(await screen.findByRole('link', { name: 'Add to wishlist' }));

    expect(await screen.findByRole('radio', { name: 'Wishlist' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Ceaco Cinderella');
  });

  it('looks up unknown barcodes, suggests look-alikes, and saves the barcode on a pick', async () => {
    db.add({ title: 'Cinderella', brand: 'Ceaco' });
    db.add({ title: 'Starry Night' });
    db.products.set(CINDERELLA, {
      title: 'Ceaco 1000 Piece Cinderella Wishes Upon A Dream Interlocking Jigsaw Puzzle',
      brand: 'Ceaco',
      pieceCount: 1000,
    });
    const user = userEvent.setup();
    renderApp(`/scan/${CINDERELLA}`);

    expect(await screen.findByRole('heading', { name: 'Not in your log yet' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Product from barcode')).toHaveTextContent(
      'Ceaco · 1000 pieces',
    );
    const suggestions = screen.getByRole('list', { name: 'Your puzzles' });
    expect(within(suggestions).getAllByRole('listitem')).toHaveLength(1);

    await user.click(within(suggestions).getByRole('button', { name: "It's Cinderella" }));

    expect(
      await screen.findByRole('heading', { name: "You've done this one" }),
    ).toBeInTheDocument();
    expect(db.patches).toEqual([{ barcode: CINDERELLA }]);
  });

  it('offers to add an unknown box, pre-filled from the lookup', async () => {
    db.products.set(CINDERELLA, { title: 'Ceaco Cinderella', brand: 'Ceaco', pieceCount: 1000 });
    const user = userEvent.setup();
    const { router } = renderApp(`/scan/${CINDERELLA}`);

    await screen.findByLabelText('Product from barcode');
    await user.click(screen.getByRole('link', { name: 'Add it as a new puzzle' }));

    expect(await screen.findByLabelText('Title')).toHaveValue('Ceaco Cinderella');
    expect(screen.getByLabelText('Brand')).toHaveValue('Ceaco');
    expect(screen.getByLabelText('Pieces')).toHaveValue('1000');
    expect(screen.getByLabelText('Barcode')).toHaveValue(CINDERELLA);

    await user.click(screen.getByRole('button', { name: /save puzzle/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect([...db.puzzles.values()][0]?.barcode).toBe(CINDERELLA);
  });

  it('still lets you check by name when the box is unknown', async () => {
    db.add({ title: 'Star Wars Posters', tags: ['Star Wars'] });
    const user = userEvent.setup();
    renderApp('/scan/079346125678'); // the Buffalo box UPCitemdb doesn't know

    expect(await screen.findByText(/couldn't identify this box/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search your puzzles'), 'star wars');
    await user.click(screen.getByRole('button', { name: "It's Star Wars Posters" }));

    expect(
      await screen.findByRole('heading', { name: "You've done this one" }),
    ).toBeInTheDocument();
    expect(db.patches).toEqual([{ barcode: '0079346125678' }]);
  });

  it('explains when the lookup service is down', async () => {
    server.use(http.get('/api/barcodes/:code', () => HttpResponse.json({}, { status: 503 })));
    renderApp(`/scan/${CINDERELLA}`);
    expect(await screen.findByText(/couldn't look this barcode up right now/i)).toBeInTheDocument();
  });

  it('accepts a typed barcode and rejects typos', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/scan');

    const input = await screen.findByLabelText('Or type the number under the barcode');
    await user.type(input, '0 21081 31114 5{Enter}');
    expect(screen.getByText(/doesn't look like a barcode number/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '0 21081 31114 4{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe(`/scan/${CINDERELLA}`));
  });
});

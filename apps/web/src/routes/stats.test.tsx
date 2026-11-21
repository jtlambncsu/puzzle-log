import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

function tile(label: string) {
  return screen.getByText(label).parentElement!;
}

describe('stats page', () => {
  it('summarizes finished puzzles, by year, brand and tag', async () => {
    const year = new Date().getFullYear();
    db.add({
      title: 'A',
      completedAt: `${year}-01-05`,
      pieceCount: 1000,
      brand: 'Ravensburger',
      tags: ['Art'],
    });
    db.add({
      title: 'B',
      completedAt: `${year - 1}-06-01`,
      pieceCount: 500,
      brand: 'Ravensburger',
    });
    db.add({ title: 'C', status: 'owned', pieceCount: 2000, brand: 'Buffalo' });
    db.add({ title: 'D', status: 'wishlist' });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'Stats' }));

    expect(await screen.findByRole('heading', { name: 'Your puzzle stats' })).toBeInTheDocument();
    expect(tile('Puzzles done')).toHaveTextContent('2');
    expect(tile('Pieces placed')).toHaveTextContent('1,500'); // owned puzzles don't count
    expect(tile(`Done in ${year}`)).toHaveTextContent('1');
    expect(tile('Owned, not started')).toHaveTextContent('1');
    expect(tile('On the wishlist')).toHaveTextContent('1');

    // The chart's numbers are also available as a table.
    await user.click(screen.getByText('Show as a table'));
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([`${year - 1}1`, `${year}1`]);

    expect(screen.getByRole('list', { name: 'Puzzles finished by brand' })).toHaveTextContent(
      'Ravensburger2',
    );
    expect(screen.getByRole('list', { name: 'Puzzles finished by tag' })).toHaveTextContent('Art1');
  });

  it('encourages finishing a puzzle when none are done', async () => {
    db.add({ title: 'Someday', status: 'wishlist' });
    renderApp('/stats');
    expect(await screen.findByText('Finish a puzzle to see more stats.')).toBeInTheDocument();
  });
});

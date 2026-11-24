import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

describe('what should I do next?', () => {
  afterEach(() => vi.restoreAllMocks());

  it('picks from owned puzzles via More, then picks a different one', async () => {
    db.add({ title: 'Castle', status: 'owned', pieceCount: 500 });
    db.add({ title: 'Lighthouse', status: 'owned', pieceCount: 1000 });
    db.add({ title: 'Already done' });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: /More/ }));
    await user.click(await screen.findByRole('link', { name: /What should I do next/ }));
    await user.click(await screen.findByRole('button', { name: 'Pick one of 2' }));

    const pick = screen.getByRole('region', { name: 'Your pick' });
    const first = within(pick).getByRole('heading').textContent;
    expect(['Castle', 'Lighthouse']).toContain(first);
    expect(within(pick).getByRole('button', { name: 'Start puzzle' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pick again' }));
    expect(
      within(screen.getByRole('region', { name: 'Your pick' })).getByRole('heading').textContent,
    ).not.toBe(first);
  });

  it('filters by size and tag, kept in the URL', async () => {
    db.add({ title: 'Small Disney', status: 'owned', pieceCount: 500, tags: ['Disney'] });
    db.add({ title: 'Big Disney', status: 'owned', pieceCount: 2000, tags: ['Disney'] });
    db.add({ title: 'Small cats', status: 'owned', pieceCount: 300, tags: ['Cats'] });
    const user = userEvent.setup();
    const { router } = renderApp('/next');

    await user.click(await screen.findByRole('radio', { name: '≤ 1,000' }));
    await user.click(screen.getByRole('button', { name: 'Disney' }));

    expect(router.state.location.search).toEqual({ max: 1000, tag: 'Disney' });
    await user.click(screen.getByRole('button', { name: 'Pick one of 1' }));
    expect(screen.getByRole('heading', { name: 'Small Disney' })).toBeInTheDocument();
  });

  it('explains when nothing is on the shelf', async () => {
    db.add({ title: 'Done', status: 'done' });
    renderApp('/next');
    expect(await screen.findByText(/No puzzles waiting on the shelf/)).toBeInTheDocument();
  });
});

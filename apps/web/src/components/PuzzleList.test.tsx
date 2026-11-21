import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuzzleList } from './PuzzleList';

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('PuzzleList', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders puzzles from the API', async () => {
    mockFetch([{ id: '1', title: 'Starry Night', pieceCount: 1000, createdAt: '' }]);
    render(<PuzzleList />);
    expect(await screen.findByText('Starry Night')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockFetch([]);
    render(<PuzzleList />);
    expect(await screen.findByText(/no puzzles yet/i)).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    mockFetch({ error: 'boom' }, 500);
    render(<PuzzleList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('500');
  });
});

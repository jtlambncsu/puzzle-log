import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Puzzle } from '@puzzle-log/shared';
import { ApiProvider } from '../api/ApiProvider';
import { ApiError, type PuzzlesApi } from '../api/client';
import { PuzzleList } from './PuzzleList';

function renderWithApi(list: PuzzlesApi['list']) {
  const api: PuzzlesApi = { list, create: vi.fn(), remove: vi.fn() };
  return render(
    <ApiProvider api={api}>
      <PuzzleList />
    </ApiProvider>,
  );
}

const starryNight: Puzzle = {
  id: '1',
  userId: 'me',
  title: 'Starry Night',
  pieceCount: 1000,
  createdAt: '',
};

describe('PuzzleList', () => {
  it('renders puzzles from the API', async () => {
    renderWithApi(async () => [starryNight]);
    expect(await screen.findByText('Starry Night')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    renderWithApi(async () => []);
    expect(await screen.findByText(/no puzzles yet/i)).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    renderWithApi(async () => {
      throw new ApiError(500, 'Request failed: 500');
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('500');
  });
});

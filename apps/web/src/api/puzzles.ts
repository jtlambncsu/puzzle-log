import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const puzzlesApi = {
  list: () => request<Puzzle[]>('/puzzles'),
  create: (input: CreatePuzzleInput) =>
    request<Puzzle>('/puzzles', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/puzzles/${id}`, { method: 'DELETE' }),
};

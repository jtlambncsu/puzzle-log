import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

/**
 * Empty in development, so requests go to `/api` on the Vite server, which proxies to the
 * local API. In production (Vercel) this is the API Gateway URL from the CDK output.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
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

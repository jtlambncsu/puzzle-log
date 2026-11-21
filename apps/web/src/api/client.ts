import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

/**
 * Empty in development, so requests go to `/api` on the Vite server, which proxies to the
 * local API. In production (Vercel) this is the API Gateway URL from the CDK output.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Returns the current access token, or undefined when auth is off (local dev). */
export type GetAccessToken = () => Promise<string | undefined>;

export function createPuzzlesApi(getAccessToken: GetAccessToken) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...init.headers,
      },
    });
    if (!res.ok) {
      throw new ApiError(
        res.status,
        res.status === 401
          ? 'Your session has expired. Sign in again.'
          : `Request failed: ${res.status}`,
      );
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  return {
    list: () => request<Puzzle[]>('/puzzles'),
    create: (input: CreatePuzzleInput) =>
      request<Puzzle>('/puzzles', { method: 'POST', body: JSON.stringify(input) }),
    remove: (id: string) => request<void>(`/puzzles/${id}`, { method: 'DELETE' }),
  };
}

export type PuzzlesApi = ReturnType<typeof createPuzzlesApi>;

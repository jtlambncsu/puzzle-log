import type { CreatePuzzleInput, Puzzle, UploadTarget } from '@puzzle-log/shared';

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

/**
 * Thin, typed wrapper around `fetch` for our API. It knows nothing about caching or React;
 * TanStack Query (see `queries.ts`) handles that on top.
 */
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
          : res.status === 404
            ? 'Not found'
            : `Request failed: ${res.status}`,
      );
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  return {
    list: () => request<Puzzle[]>('/puzzles'),
    get: (id: string) => request<Puzzle>(`/puzzles/${encodeURIComponent(id)}`),
    create: (input: CreatePuzzleInput) =>
      request<Puzzle>('/puzzles', { method: 'POST', body: JSON.stringify(input) }),
    remove: (id: string) =>
      request<void>(`/puzzles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    createUpload: (contentType: string) =>
      request<UploadTarget>('/uploads', { method: 'POST', body: JSON.stringify({ contentType }) }),
  };
}

export type PuzzlesApi = ReturnType<typeof createPuzzlesApi>;

/**
 * Sends a photo straight to S3 using a presigned POST from `createUpload`. This request
 * goes to S3, not our API, so it carries no access token: the signed form fields are the
 * permission, and they only allow this one key, this content type and up to 10 MB.
 */
export async function uploadPhoto(target: UploadTarget, photo: Blob) {
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append('file', photo); // S3 requires the file to be the last field
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new ApiError(res.status, `Photo upload failed: ${res.status}`);
}

import type {
  BarcodeLookupResult,
  CreateDetailsJobInput,
  CreatePuzzleInput,
  DetailsJob,
  Puzzle,
  StartTimerInput,
  UpdatePuzzleInput,
  UploadTarget,
} from '@puzzle-log/shared';

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

function messageForStatus(status: number) {
  switch (status) {
    case 401:
      return 'Your session has expired. Sign in again.';
    case 404:
      return 'Not found';
    case 409:
      return 'This puzzle just changed somewhere else. Reload and try again.';
    case 501:
      return "Photo uploads aren't set up on this server"; // local dev has no S3
    case 503:
      return 'That service is unavailable right now. Try again later.';
    default:
      return `Request failed: ${status}`;
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
      throw new ApiError(res.status, messageForStatus(res.status));
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  return {
    list: () => request<Puzzle[]>('/puzzles'),
    get: (id: string) => request<Puzzle>(`/puzzles/${encodeURIComponent(id)}`),
    create: (input: CreatePuzzleInput) =>
      request<Puzzle>('/puzzles', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: UpdatePuzzleInput) =>
      request<Puzzle>(`/puzzles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    /** Starts the timer (the API records the time). `today` is the local date. */
    startTimer: (id: string, today: string) =>
      request<Puzzle>(`/puzzles/${encodeURIComponent(id)}/timer/start`, {
        method: 'POST',
        body: JSON.stringify({ today } satisfies StartTimerInput),
      }),
    stopTimer: (id: string) =>
      request<Puzzle>(`/puzzles/${encodeURIComponent(id)}/timer/stop`, { method: 'POST' }),
    /** Asks the API to name an imported puzzle from its photo (AI). */
    suggest: (id: string) =>
      request<Puzzle>(`/puzzles/${encodeURIComponent(id)}/suggest`, { method: 'POST' }),
    /** Sends up to 10 puzzles to a "find details online" batch. */
    createDetailsJob: (puzzleIds: string[]) =>
      request<DetailsJob>('/details/jobs', {
        method: 'POST',
        body: JSON.stringify({ puzzleIds } satisfies CreateDetailsJobInput),
      }),
    /** Recent jobs. Also saves the results of batches that have finished. */
    listDetailsJobs: () => request<DetailsJob[]>('/details/jobs'),
    remove: (id: string) =>
      request<void>(`/puzzles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    lookupBarcode: (barcode: string) =>
      request<BarcodeLookupResult>(`/barcodes/${encodeURIComponent(barcode)}`),
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

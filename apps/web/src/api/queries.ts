import {
  QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { CreatePuzzleInput, Puzzle, UpdatePuzzleInput } from '@puzzle-log/shared';
import { compressImage, type Rotation } from '@/lib/image';
import { tagCounts } from '@/lib/search';
import { ApiError, uploadPhoto, type PuzzlesApi } from './client';
import { PERSIST_MAX_AGE } from './persist';

/**
 * Query keys in one place. Every key starts with 'puzzles', so invalidating
 * `puzzleKeys.all` refreshes the list *and* every cached detail.
 */
export const puzzleKeys = {
  all: ['puzzles'] as const,
  list: () => [...puzzleKeys.all, 'list'] as const,
  detail: (id: string) => [...puzzleKeys.all, 'detail', id] as const,
};

/**
 * `queryOptions` bundles key + fetcher so route loaders (prefetch before render) and
 * components (`useSuspenseQuery`) share exactly the same definition.
 */
export const puzzlesQueryOptions = (api: PuzzlesApi) =>
  queryOptions({ queryKey: puzzleKeys.list(), queryFn: api.list });

export const puzzleQueryOptions = (api: PuzzlesApi, id: string) =>
  queryOptions({ queryKey: puzzleKeys.detail(id), queryFn: () => api.get(id) });

/**
 * What product a barcode is. Products don't change, so once fetched it never goes stale.
 * (The server caches lookups too; this avoids even asking it again in the same session.)
 */
export const barcodeQueryOptions = (api: PuzzlesApi, barcode: string) =>
  queryOptions({
    queryKey: ['barcodes', barcode] as const,
    queryFn: () => api.lookupBarcode(barcode),
    staleTime: Infinity,
  });

/** Every tag in use, most used first: suggestions for the tag input. */
export function useAllTags() {
  const api = useApi();
  const { data = [] } = useQuery({
    ...puzzlesQueryOptions(api),
    select: (puzzles) => tagCounts(puzzles).map(({ tag }) => tag),
  });
  return data;
}

/** The API client lives in the router context (see `router.tsx`). */
export function useApi() {
  return useRouteContext({ from: '__root__', select: (context) => context.api });
}

/** Retry server hiccups, but not 4xx responses: those won't fix themselves. */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Photo URLs are signed for an hour; 30s keeps navigation snappy without serving
        // stale data for long.
        staleTime: 30_000,
        // Keep data in memory (and in the offline copy) for as long as it's persisted.
        gcTime: PERSIST_MAX_AGE,
        retry: shouldRetry,
      },
    },
  });
}

export interface CreatePuzzleVariables {
  input: CreatePuzzleInput;
  photo?: File;
  rotation?: Rotation;
}

/** Shrinks (and rotates) a photo and uploads it to S3, returning its key. */
async function uploadPreparedPhoto(api: PuzzlesApi, photo: Blob, rotation: Rotation = 0) {
  const prepared = await compressImage(photo, { rotation });
  const target = await api.createUpload(prepared.type);
  await uploadPhoto(target, prepared);
  return target.key;
}

/**
 * Saves one puzzle, uploading its photo first: 1. shrink the photo in the browser, 2. ask our
 * API for a presigned upload, 3. upload straight to S3, 4. save the puzzle with that key.
 * Plain async function (no cache updates) so single and bulk adds can share it.
 */
export async function savePuzzle(
  api: PuzzlesApi,
  { input, photo, rotation }: CreatePuzzleVariables,
) {
  const imageKey = photo ? await uploadPreparedPhoto(api, photo, rotation) : undefined;
  return api.create({ ...input, imageKey });
}

export function useCreatePuzzle() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CreatePuzzleVariables) => savePuzzle(api, variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: puzzleKeys.all }),
  });
}

export function useUpdatePuzzle() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePuzzleInput }) => api.update(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(puzzleKeys.detail(updated.id), updated);
      return queryClient.invalidateQueries({ queryKey: puzzleKeys.list() });
    },
  });
}

/**
 * Downloads a stored photo so the browser can edit it.
 *
 * `cache: 'no-store'` matters: the page already showed this photo with an <img>, which sends
 * no Origin header, so S3 answered without CORS headers (and without `Vary: Origin`). Safari
 * then reuses that cached response for this cross-origin fetch and blocks it ("Load failed").
 * Skipping the cache makes S3 answer this request with the CORS headers it needs.
 */
async function downloadPhoto(url: string) {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error("Couldn't download the photo. Check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, "Couldn't download the photo");
  return res;
}

/**
 * Rotates an already-saved photo: download it, rotate the pixels in the browser, upload the
 * result as a new photo, and point the puzzle at it (the API deletes the old one).
 */
export function useRotatePuzzlePhoto() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ puzzle, rotation }: { puzzle: Puzzle; rotation: Rotation }) => {
      if (!puzzle.imageUrl) throw new Error('This puzzle has no photo');
      const res = await downloadPhoto(puzzle.imageUrl);
      const imageKey = await uploadPreparedPhoto(api, await res.blob(), rotation);
      return api.update(puzzle.id, { imageKey });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(puzzleKeys.detail(updated.id), updated);
      return queryClient.invalidateQueries({ queryKey: puzzleKeys.list() });
    },
  });
}

export function useDeletePuzzle() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: puzzleKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: puzzleKeys.list() });
    },
  });
}

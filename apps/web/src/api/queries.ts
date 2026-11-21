import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { CreatePuzzleInput } from '@puzzle-log/shared';
import { compressImage } from '@/lib/image';
import { ApiError, uploadPhoto, type PuzzlesApi } from './client';

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
        retry: shouldRetry,
      },
    },
  });
}

export interface CreatePuzzleVariables {
  input: CreatePuzzleInput;
  photo?: File;
}

export function useCreatePuzzle() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, photo }: CreatePuzzleVariables) => {
      let imageKey: string | undefined;
      if (photo) {
        // 1. shrink the photo in the browser, 2. ask our API for a presigned upload,
        // 3. upload straight to S3, 4. save the puzzle pointing at the uploaded key.
        const compressed = await compressImage(photo);
        const target = await api.createUpload(compressed.type);
        await uploadPhoto(target, compressed);
        imageKey = target.key;
      }
      return api.create({ ...input, imageKey });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: puzzleKeys.all }),
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

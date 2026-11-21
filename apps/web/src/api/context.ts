import { createContext, useContext } from 'react';
import type { PuzzlesApi } from './client';

export const ApiContext = createContext<PuzzlesApi | null>(null);

/** The API client for the current user. Must be used inside `<ApiProvider>`. */
export function usePuzzlesApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('usePuzzlesApi must be used inside <ApiProvider>');
  return api;
}

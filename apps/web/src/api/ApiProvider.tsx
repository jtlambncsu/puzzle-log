import type { ReactNode } from 'react';
import type { PuzzlesApi } from './client';
import { ApiContext } from './context';

/** Makes the API client available to components. Tests pass a fake here. */
export function ApiProvider({ api, children }: { api: PuzzlesApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

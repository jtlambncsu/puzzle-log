import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { PuzzlesApi } from '@/api/client';
import { routeTree } from './routeTree.gen';

/** The signed-in user, or null when login is off (local development). */
export interface AuthInfo {
  email?: string;
  signOut: () => void;
}

/**
 * Everything routes need, injected once instead of imported: loaders use it to prefetch
 * data, and tests pass fakes. Type-checked in every route via `createRootRouteWithContext`.
 */
export interface RouterContext {
  queryClient: QueryClient;
  api: PuzzlesApi;
  auth: AuthInfo | null;
}

export function createAppRouter(context: RouterContext, options: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree,
    context,
    // Loaders hand data to TanStack Query, so the router shouldn't cache it a second time.
    defaultPreloadStaleTime: 0,
    // Start loading a page's data when a link is hovered or touched.
    defaultPreload: 'intent',
    scrollRestoration: true,
    ...options,
  });
}

// Lets `Link`, `useNavigate` etc. know every route and its params at compile time.
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

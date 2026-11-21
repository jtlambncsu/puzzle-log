import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createPuzzlesApi } from '@/api/client';
import { Toaster } from '@/components/ui/sonner';
import { createAppRouter } from '@/router';

/** Renders the whole app at `path`, with a fresh cache and the MSW-backed API. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter(
    {
      queryClient,
      api: createPuzzlesApi(async () => 'test-token'),
      auth: { email: 'me@example.com', signOut: () => {} },
    },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

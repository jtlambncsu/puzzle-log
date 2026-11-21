import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from 'react-oidc-context';
import { createPuzzlesApi } from '@/api/client';
import { PERSIST_BUSTER, PERSIST_MAX_AGE, persister } from '@/api/persist';
import { createQueryClient } from '@/api/queries';
import { AuthGate } from '@/auth/AuthGate';
import { getAccessToken, onSigninCallback, userManager } from '@/auth/config';
import { Toaster } from '@/components/ui/sonner';
import { createAppRouter, type AuthInfo } from '@/router';
import './index.css';

// Service worker: caches the app for offline use and updates it in the background.
registerSW({ immediate: true });

const queryClient = createQueryClient();
const router = createAppRouter({
  queryClient,
  api: createPuzzlesApi(getAccessToken),
  auth: null,
});

/** Don't leave someone's puzzles on a shared device after they sign out. */
async function forgetSavedData() {
  queryClient.clear();
  await persister.removeClient();
}

function App({ auth }: { auth: AuthInfo | null }) {
  // Wait until the saved (offline) cache is restored before routing. Otherwise route loaders
  // fetch before it's back: offline they'd wait forever, and online the fresh data would load
  // before the cache starts saving changes, so it would never be saved for next time.
  const isRestoring = useIsRestoring();
  if (isRestoring) return null;
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        // Leave out queries that opt out (AI suggestions: their result is saved on the puzzle).
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.meta?.persist !== false,
        },
      }}
    >
      {userManager ? (
        <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
          <AuthGate onSignOut={forgetSavedData}>{(auth) => <App auth={auth} />}</AuthGate>
        </AuthProvider>
      ) : (
        <App auth={null} />
      )}
      <Toaster position="top-center" richColors />
      {/* Only included in development builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </PersistQueryClientProvider>
  </StrictMode>,
);

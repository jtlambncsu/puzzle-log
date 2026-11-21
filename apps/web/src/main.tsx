import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from 'react-oidc-context';
import { createPuzzlesApi } from '@/api/client';
import { createQueryClient } from '@/api/queries';
import { AuthGate } from '@/auth/AuthGate';
import { getAccessToken, onSigninCallback, userManager } from '@/auth/config';
import { Toaster } from '@/components/ui/sonner';
import { createAppRouter, type AuthInfo } from '@/router';
import './index.css';

const queryClient = createQueryClient();
const router = createAppRouter({
  queryClient,
  api: createPuzzlesApi(getAccessToken),
  auth: null,
});

function App({ auth }: { auth: AuthInfo | null }) {
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {userManager ? (
        <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
          <AuthGate>{(auth) => <App auth={auth} />}</AuthGate>
        </AuthProvider>
      ) : (
        <App auth={null} />
      )}
      <Toaster position="top-center" richColors />
      {/* Only included in development builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>,
);

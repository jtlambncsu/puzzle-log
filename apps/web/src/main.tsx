import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { App } from './App';
import { ApiProvider } from './api/ApiProvider';
import { createPuzzlesApi } from './api/client';
import { AuthGate } from './auth/AuthGate';
import { getAccessToken, onSigninCallback, userManager } from './auth/config';
import './index.css';

const api = createPuzzlesApi(getAccessToken);

const app = (
  <ApiProvider api={api}>
    <App />
  </ApiProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {userManager ? (
      <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
        <AuthGate>{app}</AuthGate>
      </AuthProvider>
    ) : (
      app
    )}
  </StrictMode>,
);

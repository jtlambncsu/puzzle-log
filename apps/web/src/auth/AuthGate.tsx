import type { ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { cognitoLogoutUrl } from './config';

/** Shows the app only to signed-in users, with a sign-in screen for everyone else. */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) return <p className="container">Loading…</p>;

  if (auth.error) {
    return (
      <div className="container">
        <p role="alert">Sign-in failed: {auth.error.message}</p>
        <button onClick={() => void auth.signinRedirect()}>Try again</button>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="container sign-in">
        <h1>🧩 Puzzle Log</h1>
        <p>Sign in to see your puzzles.</p>
        <button onClick={() => void auth.signinRedirect()}>Sign in</button>
      </main>
    );
  }

  async function signOut() {
    await auth.removeUser(); // forget tokens locally
    window.location.assign(cognitoLogoutUrl()); // end the Cognito session too
  }

  return (
    <>
      <div className="user-bar">
        <span>{auth.user?.profile.email}</span>
        <button onClick={() => void signOut()}>Sign out</button>
      </div>
      {children}
    </>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import type { AuthInfo } from '@/router';
import { cognitoLogoutUrl } from './config';

interface AuthGateProps {
  children: (auth: AuthInfo) => ReactNode;
  /** Runs before signing out, e.g. to delete data saved for offline use. */
  onSignOut?: () => Promise<void>;
}

/**
 * Shows the app only to signed-in users, with a sign-in screen for everyone else.
 *
 * Access tokens last an hour. An expired one isn't "signed out": the refresh token (30 days)
 * can get a new one silently, and while offline the user can still see their saved puzzles,
 * so the sign-in screen is the last resort.
 */
export function AuthGate({ children, onSignOut }: AuthGateProps) {
  const auth = useAuth();
  const online = useOnlineStatus();
  const [refreshFailed, setRefreshFailed] = useState(false);
  const refreshStarted = useRef(false);
  // react-oidc-context reports a silent sign-in in progress; no need to track it ourselves.
  const refreshing = auth.activeNavigator === 'signinSilent';
  const expiredUser = !auth.isAuthenticated && auth.user?.expired ? auth.user : undefined;

  // Coming back after the token expired (or reconnecting with one): refresh before asking.
  // Runs once, the first time we're online with an expired token.
  useEffect(() => {
    if (!expiredUser || !online || auth.isLoading || refreshStarted.current) return;
    refreshStarted.current = true;
    auth.signinSilent().catch(() => setRefreshFailed(true));
  }, [expiredUser, online, auth]);

  const signedIn = (email?: string): AuthInfo => ({
    email,
    signOut: () => {
      void (async () => {
        await onSignOut?.();
        await auth.removeUser(); // forget tokens locally…
        window.location.assign(cognitoLogoutUrl()); // …and end the Cognito session too
      })();
    },
  });

  if (auth.isLoading || refreshing || (expiredUser && online && !refreshFailed)) {
    return (
      <Centered>
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </Centered>
    );
  }

  if (auth.isAuthenticated) return children(signedIn(auth.user?.profile.email));

  // Offline with an expired token: show saved data; changes wait for a connection.
  if (expiredUser && !online) return children(signedIn(expiredUser.profile.email));

  if (auth.error && !expiredUser) {
    return (
      <Centered>
        <p role="alert" className="text-muted-foreground">
          Sign-in failed: {auth.error.message}
        </p>
        <Button onClick={() => void auth.signinRedirect()}>Try again</Button>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="text-5xl" aria-hidden>
        🧩
      </div>
      <h1 className="font-heading text-2xl font-semibold">Puzzle Log</h1>
      <p className="text-muted-foreground">Sign in to see your puzzles.</p>
      <Button size="lg" onClick={() => void auth.signinRedirect()}>
        Sign in
      </Button>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}

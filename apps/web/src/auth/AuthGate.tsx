import type { ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuthInfo } from '@/router';
import { cognitoLogoutUrl } from './config';

/**
 * Shows the app only to signed-in users, with a sign-in screen for everyone else.
 * Passes the signed-in user to its children (the router puts it in route context).
 */
export function AuthGate({ children }: { children: (auth: AuthInfo) => ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <Centered>
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </Centered>
    );
  }

  if (auth.error) {
    return (
      <Centered>
        <p role="alert" className="text-muted-foreground">
          Sign-in failed: {auth.error.message}
        </p>
        <Button onClick={() => void auth.signinRedirect()}>Try again</Button>
      </Centered>
    );
  }

  if (!auth.isAuthenticated) {
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

  return children({
    email: auth.user?.profile.email,
    signOut: () => {
      // Forget tokens locally, then end the Cognito session too.
      void auth.removeUser().then(() => window.location.assign(cognitoLogoutUrl()));
    },
  });
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}

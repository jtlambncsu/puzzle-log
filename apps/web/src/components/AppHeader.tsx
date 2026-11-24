import { Link, useRouteContext } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A slim title bar. Navigation lives in the tab bar at the bottom (AppNav). */
export function AppHeader() {
  const auth = useRouteContext({ from: '__root__', select: (context) => context.auth });

  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 px-4">
        <Link
          to="/"
          className="mr-auto flex min-w-0 items-center gap-2 font-heading text-lg font-semibold tracking-tight"
        >
          <span aria-hidden>🧩</span>
          Puzzle Log
        </Link>
        {auth && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={auth.signOut}
            aria-label={`Sign out${auth.email ? ` ${auth.email}` : ''}`}
            title={auth.email ? `Signed in as ${auth.email}` : undefined}
          >
            <LogOutIcon />
          </Button>
        )}
      </div>
    </header>
  );
}

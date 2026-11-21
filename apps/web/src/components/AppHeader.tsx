import { Link, useRouteContext } from '@tanstack/react-router';
import { LogOutIcon, PlusIcon, ScanBarcodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  const auth = useRouteContext({ from: '__root__', select: (context) => context.auth });

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        <Link to="/" className="mr-auto min-w-0 truncate font-heading text-lg font-semibold">
          🧩 Puzzle Log
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/scan">
            <ScanBarcodeIcon aria-hidden />
            Scan
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/puzzles/new">
            <PlusIcon aria-hidden />
            Add
          </Link>
        </Button>
        {auth && (
          <Button
            variant="ghost"
            size="icon"
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

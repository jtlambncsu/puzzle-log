import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { AppHeader } from '@/components/AppHeader';
import { AppNav } from '@/components/AppNav';
import { ErrorState } from '@/components/ErrorState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button } from '@/components/ui/button';
import type { RouterContext } from '@/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <OfflineBanner />
      {/* Bottom padding keeps the last content clear of the tab bar. */}
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-32">
        <Outlet />
      </main>
      <AppNav />
    </div>
  );
}

/** Shown when a loader or component throws. "Try again" re-runs the failed queries. */
function RootError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Something went wrong'}
          onRetry={() => {
            reset();
            void router.invalidate();
          }}
        />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-muted-foreground">That page doesn't exist.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to your puzzles</Link>
      </Button>
    </div>
  );
}

import { WifiOffIcon } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

/** Explains what still works offline: everything you've already loaded, read-only. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      <WifiOffIcon className="size-4 shrink-0" aria-hidden />
      You're offline. Showing your saved puzzles; changes need a connection.
    </div>
  );
}

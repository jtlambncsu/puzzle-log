import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Whether the browser thinks it has a connection. `useSyncExternalStore` is React's way to
 * read an outside value (here, `navigator.onLine`) and re-render when it changes.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}

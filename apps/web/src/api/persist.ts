import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

/**
 * Saves TanStack Query's cache (your puzzle list, barcode lookups) to IndexedDB, so the app
 * shows your puzzles instantly on launch and works offline, e.g. checking a box in a shop
 * with no signal. Cleared on sign-out.
 */
export const persister = createAsyncStoragePersister({
  key: 'puzzle-log-query-cache',
  storage: { getItem: get, setItem: set, removeItem: del },
});

/** How long saved data is trusted offline. Queries keep it at least this long too. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Bump when the shape of cached API data changes, to throw old caches away. */
export const PERSIST_BUSTER = 'v1';

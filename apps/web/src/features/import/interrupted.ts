/**
 * Remembers that an import is in progress, so that if the phone runs out of memory and
 * Safari reloads the page (which loses everything in it), the next visit can say what
 * happened instead of silently showing the start page again.
 *
 * localStorage, not React state: it survives the reload. Wrapped in try/catch because
 * storage can be unavailable (private browsing, blocked site data); then this just does
 * nothing.
 */
const KEY = 'puzzle-log:import-in-progress';

export interface InterruptedImport {
  step: 'checking' | 'uploading';
  photos: number;
}

export function markImportInProgress(value: InterruptedImport) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

export function clearImportInProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}

/** An import that never finished, if any. Reading it also clears it. */
export function takeInterruptedImport(): InterruptedImport | undefined {
  try {
    const value = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return value ? (JSON.parse(value) as InterruptedImport) : undefined;
  } catch {
    return undefined;
  }
}

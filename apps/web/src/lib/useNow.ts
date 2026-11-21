import { useEffect, useState } from 'react';

/**
 * The current time (ms), ticking every `intervalMs` while `enabled`, e.g. while a timer runs.
 * Stopped, it holds its last value, which is fine for a timer: nothing is counting then, and
 * the first tick after starting again corrects it.
 */
export function useNow(enabled: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

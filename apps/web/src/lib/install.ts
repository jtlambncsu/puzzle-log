import { useSyncExternalStore } from 'react';

/**
 * Chrome, Edge and Android fire `beforeinstallprompt` when the app can be installed, often
 * before React has rendered anything. It's captured here, at startup (main.tsx imports this
 * file), and shown later as an "Install" button. Safari never fires it: iPhone users install
 * from the Share menu, so the card shows the steps instead.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the browser's own mini bar; our card offers it instead
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = undefined;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows the browser's install dialog; resolves to whether the app was installed. */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = undefined;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

export type InstallMethod = 'installed' | 'ios' | 'prompt' | 'none';

/**
 * How this device can install the app:
 * - `installed`: already running from the home screen
 * - `ios`: iPhone or iPad, by hand from the Share menu
 * - `prompt`: the browser offered to install it (Chrome, Edge, Android)
 * - `none`: can't tell how, or can't install (e.g. Firefox on a computer)
 */
export function installMethod({
  userAgent,
  maxTouchPoints,
  standalone,
  canPrompt,
}: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  canPrompt: boolean;
}): InstallMethod {
  if (standalone) return 'installed';
  // iPads say they're Macs; a touch screen gives them away.
  const apple =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (apple) return 'ios';
  return canPrompt ? 'prompt' : 'none';
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallMethod(): InstallMethod {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferredPrompt);
  return installMethod({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    canPrompt,
  });
}

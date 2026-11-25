import { useState } from 'react';
import { DownloadIcon, ShareIcon, SmartphoneIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { promptInstall, useInstallMethod } from '@/lib/install';

const DISMISSED_KEY = 'puzzle-log:install-dismissed';

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Suggests adding the app to the home screen, where it opens full screen with its own icon
 * and launch screen. iPhones get the steps (Safari has no install button for websites to
 * call); Chrome and Android get a button. Hidden once installed.
 *
 * @param dismissible Show a close button, remembered on this device (the home page). The
 *   More page shows it without one, so the steps can always be found again.
 */
export function InstallCard({ dismissible = false }: { dismissible?: boolean }) {
  const method = useInstallMethod();
  const [dismissed, setDismissed] = useState(() => dismissible && wasDismissed());
  if (dismissed || method === 'installed' || method === 'none') return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // storage unavailable: it just shows again next time
    }
  }

  return (
    <section
      aria-labelledby="install-heading"
      className="relative mb-4 rounded-2xl border border-primary/20 bg-accent p-4 text-sm text-accent-foreground"
    >
      {dismissible && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-accent-foreground hover:bg-primary/10"
          aria-label="Don't show again"
          onClick={dismiss}
        >
          <XIcon />
        </Button>
      )}
      <h2 id="install-heading" className="flex items-center gap-2 pr-8 font-semibold">
        <SmartphoneIcon className="size-4 shrink-0" aria-hidden />
        Install Puzzle Log on your phone
      </h2>
      <p className="mt-1 opacity-80">
        It opens full screen from its own icon, like any other app. Free, no App Store needed.
      </p>
      {method === 'ios' ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>
            Tap <strong>Share</strong>{' '}
            <ShareIcon className="inline size-3.5 align-[-2px]" aria-hidden />. In Safari, it may be
            under the <strong>•••</strong> button.
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>. You may need to scroll down to find it.
          </li>
          <li>
            Leave <strong>Open as Web App</strong> on, then tap <strong>Add</strong>.
          </li>
        </ol>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => void promptInstall()}>
          <DownloadIcon aria-hidden />
          Install
        </Button>
      )}
    </section>
  );
}

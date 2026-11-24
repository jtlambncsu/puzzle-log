import { Link, type LinkProps } from '@tanstack/react-router';
import {
  ChartColumnIcon,
  EllipsisIcon,
  LayoutGridIcon,
  PlusIcon,
  ScanBarcodeIcon,
  type LucideIcon,
} from 'lucide-react';

interface Tab {
  to: LinkProps['to'];
  label: string;
  icon: LucideIcon;
  /** Exact match, so "Puzzles" isn't active on every page under "/". */
  exact?: boolean;
}

const LEFT: Tab[] = [
  { to: '/', label: 'Puzzles', icon: LayoutGridIcon, exact: true },
  { to: '/stats', label: 'Stats', icon: ChartColumnIcon },
];
const RIGHT: Tab[] = [
  { to: '/scan', label: 'Scan', icon: ScanBarcodeIcon },
  { to: '/more', label: 'More', icon: EllipsisIcon },
];

/**
 * The app's main navigation: a floating tab bar at the bottom of the screen, where a thumb
 * reaches on a phone, with "Add" in the middle. It clears the iPhone home indicator
 * (`safe-area-inset-bottom`, which needs `viewport-fit=cover`).
 */
export function AppNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between rounded-2xl border bg-background/90 px-1.5 py-1.5 shadow-lg shadow-black/5 backdrop-blur-md">
        {LEFT.map((tab) => (
          <NavTab key={tab.label} tab={tab} />
        ))}
        <li>
          <Link
            to="/puzzles/new"
            aria-label="Add"
            className="mx-1 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <PlusIcon className="size-6" aria-hidden />
          </Link>
        </li>
        {RIGHT.map((tab) => (
          <NavTab key={tab.label} tab={tab} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ tab: { to, label, icon: Icon, exact } }: { tab: Tab }) {
  return (
    <li className="flex-1">
      <Link
        to={to}
        activeOptions={{ exact, includeSearch: false }}
        className="group flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:text-primary"
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
    </li>
  );
}

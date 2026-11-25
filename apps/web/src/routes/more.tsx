import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  CopyIcon,
  DicesIcon,
  DatabaseBackupIcon,
  FolderInputIcon,
} from 'lucide-react';
import { InstallCard } from '@/components/InstallCard';

export const Route = createFileRoute('/more')({
  component: MorePage,
});

/** Each entry's `to` is checked against the app's routes by TanStack Router's types. */
const TOOLS = [
  {
    to: '/puzzles/import',
    icon: FolderInputIcon,
    title: 'Import photos',
    description: 'Add puzzles from your camera roll, duplicates skipped',
  },
  {
    to: '/next',
    icon: DicesIcon,
    title: 'What should I do next?',
    description: 'A random pick from the puzzles you own',
  },
  {
    to: '/duplicates',
    icon: CopyIcon,
    title: 'Duplicates',
    description: 'Find puzzles logged twice and keep one',
  },
  {
    to: '/backup',
    icon: DatabaseBackupIcon,
    title: 'Backup',
    description: 'Download your log as a spreadsheet, and your photos',
  },
] as const;

/** Tools that don't need a spot in the header. */
function MorePage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">More</h1>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {TOOLS.map(({ to, icon: Icon, title, description }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <InstallCard />
    </div>
  );
}

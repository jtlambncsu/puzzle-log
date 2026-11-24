import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  CopyIcon,
  DicesIcon,
  DatabaseBackupIcon,
  FolderInputIcon,
} from 'lucide-react';

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
      <h1 className="font-heading text-xl font-semibold">More</h1>
      <ul className="space-y-2">
        {TOOLS.map(({ to, icon: Icon, title, description }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

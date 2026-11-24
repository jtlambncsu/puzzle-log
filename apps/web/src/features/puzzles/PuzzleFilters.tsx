import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PUZZLE_STATUSES, type PuzzleStatus } from '@puzzle-log/shared';
import { sameTag, type TagCount } from '@/lib/search';
import { STATUS_INFO } from '@/lib/status';
import { cn } from '@/lib/utils';

interface PuzzleFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  tags: TagCount[];
  selectedTag?: string;
  onTagChange: (tag: string | undefined) => void;
  statusCounts: Record<PuzzleStatus, number>;
  selectedStatus?: PuzzleStatus;
  onStatusChange: (status: PuzzleStatus | undefined) => void;
}

const chipClass = (selected: boolean, small = false) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors',
    small ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
    selected
      ? 'border-primary bg-primary text-primary-foreground'
      : small
        ? 'border-transparent bg-secondary text-secondary-foreground hover:bg-muted'
        : 'bg-card hover:bg-muted',
  );

/** Search box plus a row of tag chips. Tapping the selected tag again clears it. */
export function PuzzleFilters({
  query,
  onQueryChange,
  tags,
  selectedTag,
  onTagChange,
  statusCounts,
  selectedStatus,
  onStatusChange,
}: PuzzleFiltersProps) {
  // Only worth showing once something isn't "done".
  const showStatuses = statusCounts.in_progress + statusCounts.owned + statusCounts.wishlist > 0;
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search puzzles"
          placeholder="Search titles, brands, notes, tags"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          enterKeyHint="search"
          // Hide the browser's own clear button; ours works the same everywhere.
          className="h-11 rounded-xl bg-card pr-9 pl-9 shadow-xs [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      {showStatuses && (
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4" aria-label="Filter by status">
          {PUZZLE_STATUSES.map((status) => {
            const { label, icon: Icon } = STATUS_INFO[status];
            const selected = selectedStatus === status;
            const count = statusCounts[status];
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${label}, ${count} ${count === 1 ? 'puzzle' : 'puzzles'}`}
                  onClick={() => onStatusChange(selected ? undefined : status)}
                  className={chipClass(selected)}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                  <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tags.length > 0 && (
        // One scrollable row, so many tags don't push the puzzles off a phone screen.
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ul className="flex w-max gap-1.5" aria-label="Filter by tag">
            {tags.map(({ tag, count }) => {
              const selected = !!selectedTag && sameTag(tag, selectedTag);
              return (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${tag}, ${count} ${count === 1 ? 'puzzle' : 'puzzles'}`}
                    onClick={() => onTagChange(selected ? undefined : tag)}
                    className={chipClass(selected, true)}
                  >
                    {tag}
                    <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  ChevronRightIcon,
  FolderInputIcon,
  ImagesIcon,
  PlusIcon,
  PuzzleIcon,
  SearchXIcon,
} from 'lucide-react';
import { z } from 'zod';
import { puzzleStatus, statusSchema, type PuzzleStatus } from '@puzzle-log/shared';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { InstallCard } from '@/components/InstallCard';
import { Button } from '@/components/ui/button';
import { PuzzleGrid } from '@/features/puzzles/PuzzleGrid';
import { PuzzleFilters } from '@/features/puzzles/PuzzleFilters';
import { PuzzleGridSkeleton } from '@/features/puzzles/PuzzleGridSkeleton';
import { hasTag, matchesSearch, tagCounts } from '@/lib/search';
import { STATUS_INFO } from '@/lib/status';

/**
 * Search and tag filter live in the URL (`/?q=hoth&tag=Star+Wars`), so back/forward,
 * refresh and bookmarks keep them, and links like `<Link to="/" search={{ tag }}>` are
 * type-checked. `.catch` drops malformed values instead of showing an error page.
 */
// The router's default URL parser turns `?q=1000` into a number, so accept those as text.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);

const listSearchSchema = z.object({
  q: text,
  tag: text,
  status: statusSchema.optional().catch(undefined),
});

export const Route = createFileRoute('/')({
  validateSearch: listSearchSchema,
  // Start fetching before the page renders; the component then reads from the cache.
  // Filtering happens in the browser, so changing the search doesn't refetch.
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  pendingComponent: PuzzleGridSkeleton,
  component: PuzzleListPage,
});

function PuzzleListPage() {
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const { q = '', tag, status } = Route.useSearch();
  const navigate = Route.useNavigate();

  if (puzzles.length === 0) return <EmptyState />;

  // A personal list is small enough to filter on every keystroke in the browser.
  const matching = puzzles.filter(
    (puzzle) =>
      matchesSearch(puzzle, q) &&
      (!tag || hasTag(puzzle, tag)) &&
      (!status || puzzleStatus(puzzle) === status),
  );
  const filtered = !!q || !!tag || !!status;

  const toReview = puzzles.filter((puzzle) => puzzle.needsReview).length;

  function setSearch(next: { q?: string; tag?: string; status?: PuzzleStatus }) {
    // `replace` so each keystroke doesn't add a browser history entry.
    void navigate({
      search: (current) => ({ ...current, ...next }),
      replace: true,
    });
  }

  return (
    <>
      <h1 className="mb-4 font-heading text-3xl font-semibold tracking-tight">
        Your puzzles{' '}
        <span className="font-sans text-base font-normal text-muted-foreground" aria-live="polite">
          ({filtered ? `${matching.length} of ${puzzles.length}` : puzzles.length})
        </span>
      </h1>

      <InstallCard dismissible />

      {toReview > 0 && (
        <Link
          to="/review"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-accent p-3 text-sm text-accent-foreground transition-colors hover:bg-accent/70"
        >
          <FolderInputIcon className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="font-medium">
              {toReview} imported {toReview === 1 ? 'puzzle' : 'puzzles'} to review
            </span>
            <span className="block opacity-80">Check their titles and tags</span>
          </span>
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      )}

      <PuzzleFilters
        query={q}
        onQueryChange={(value) => setSearch({ q: value || undefined })}
        tags={tagCounts(puzzles)}
        selectedTag={tag}
        onTagChange={(value) => setSearch({ tag: value })}
        statusCounts={countStatuses(puzzles)}
        selectedStatus={status}
        onStatusChange={(value) => setSearch({ status: value })}
      />

      {matching.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchXIcon className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="text-muted-foreground">
            No {status ? STATUS_INFO[status].label.toLowerCase() : ''} puzzles match
            {q && <> “{q}”</>}
            {tag && <> tagged “{tag}”</>}.
          </p>
          <Button
            variant="outline"
            onClick={() => setSearch({ q: undefined, tag: undefined, status: undefined })}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <PuzzleGrid puzzles={matching} />
      )}
    </>
  );
}

function countStatuses(puzzles: readonly { status?: PuzzleStatus }[]) {
  const counts: Record<PuzzleStatus, number> = { done: 0, in_progress: 0, owned: 0, wishlist: 0 };
  for (const puzzle of puzzles) counts[puzzleStatus(puzzle)]++;
  return counts;
}

function EmptyState() {
  return (
    <>
      <InstallCard dismissible />
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <PuzzleIcon className="size-12 text-muted-foreground/50" aria-hidden />
        <div>
          <h1 className="font-heading text-2xl font-semibold">No puzzles yet</h1>
          <p className="text-muted-foreground">Finished one? Snap a photo and log it.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/puzzles/new">
              <PlusIcon aria-hidden />
              Add your first puzzle
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/puzzles/bulk">
              <ImagesIcon aria-hidden />
              Add several from photos
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/puzzles/import">
              <FolderInputIcon aria-hidden />
              Import a whole album
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

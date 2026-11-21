import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ImagesIcon, PlusIcon, PuzzleIcon, SearchXIcon } from 'lucide-react';
import { z } from 'zod';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { PuzzleCard } from '@/features/puzzles/PuzzleCard';
import { PuzzleFilters } from '@/features/puzzles/PuzzleFilters';
import { PuzzleGridSkeleton } from '@/features/puzzles/PuzzleGridSkeleton';
import { hasTag, matchesSearch, tagCounts } from '@/lib/search';

/**
 * Search and tag filter live in the URL (`/?q=hoth&tag=Star+Wars`), so back/forward,
 * refresh and bookmarks keep them, and links like `<Link to="/" search={{ tag }}>` are
 * type-checked. `.catch` drops malformed values instead of showing an error page.
 */
// The router's default URL parser turns `?q=1000` into a number, so accept those as text.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);

const listSearchSchema = z.object({ q: text, tag: text });

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
  const { q = '', tag } = Route.useSearch();
  const navigate = Route.useNavigate();

  if (puzzles.length === 0) return <EmptyState />;

  // A personal list is small enough to filter on every keystroke in the browser.
  const matching = puzzles.filter(
    (puzzle) => matchesSearch(puzzle, q) && (!tag || hasTag(puzzle, tag)),
  );
  const filtered = !!q || !!tag;

  function setSearch(next: { q?: string; tag?: string }) {
    // `replace` so each keystroke doesn't add a browser history entry.
    void navigate({
      search: (current) => ({ ...current, ...next }),
      replace: true,
    });
  }

  return (
    <>
      <h1 className="mb-3 font-heading text-xl font-semibold">
        Your puzzles{' '}
        <span className="text-muted-foreground" aria-live="polite">
          ({filtered ? `${matching.length} of ${puzzles.length}` : puzzles.length})
        </span>
      </h1>

      <PuzzleFilters
        query={q}
        onQueryChange={(value) => setSearch({ q: value || undefined })}
        tags={tagCounts(puzzles)}
        selectedTag={tag}
        onTagChange={(value) => setSearch({ tag: value })}
      />

      {matching.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchXIcon className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="text-muted-foreground">
            No puzzles match{q && <> “{q}”</>}
            {tag && <> tagged “{tag}”</>}.
          </p>
          <Button variant="outline" onClick={() => setSearch({ q: undefined, tag: undefined })}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {matching.map((puzzle) => (
            <li key={puzzle.id}>
              <PuzzleCard puzzle={puzzle} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <PuzzleIcon className="size-12 text-muted-foreground/50" aria-hidden />
      <div>
        <h1 className="font-heading text-xl font-semibold">No puzzles yet</h1>
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
      </div>
    </div>
  );
}

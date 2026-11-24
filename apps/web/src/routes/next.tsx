import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { DicesIcon } from 'lucide-react';
import { z } from 'zod';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PuzzleCard } from '@/features/puzzles/PuzzleCard';
import { StatusActions } from '@/features/puzzles/StatusActions';
import { pickCandidates, pickNext } from '@/lib/pickNext';
import { tagCounts } from '@/lib/search';

const SIZES = [500, 1000, 1500] as const;

/**
 * Filters live in the URL (`/next?max=1000&tag=Disney`), like the list's search, so a
 * favourite combination can be bookmarked. Bad values are dropped, not errors.
 */
const nextSearchSchema = z.object({
  max: z.coerce
    .number()
    .refine((value) => (SIZES as readonly number[]).includes(value))
    .optional()
    .catch(undefined),
  tag: z.union([z.string(), z.number()]).transform(String).optional().catch(undefined),
});

export const Route = createFileRoute('/next')({
  validateSearch: nextSearchSchema,
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  component: NextPage,
});

/** "What should I do next?": a random puzzle from the ones you own but haven't started. */
function NextPage() {
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const { max, tag } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [pickedId, setPickedId] = useState<string>();

  const candidates = pickCandidates(puzzles, { maxPieces: max, tag });
  // Tags to filter by: those on the whole pile, most common first.
  const tags = tagCounts(pickCandidates(puzzles, {})).slice(0, 12);
  // The puzzle picked, while it still matches (filters or its status may have changed).
  const picked = candidates.find((puzzle) => puzzle.id === pickedId);

  function setFilters(next: { max?: number; tag?: string }) {
    void navigate({ search: (current) => ({ ...current, ...next }), replace: true });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          What should I do next?
        </h1>
        <p className="text-sm text-muted-foreground">
          A random pick from the puzzles you own but haven't started.
        </p>
      </div>

      <div className="space-y-3">
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={max ? String(max) : 'any'}
          onValueChange={(value) =>
            value && setFilters({ max: value === 'any' ? undefined : Number(value) })
          }
          aria-label="Size"
          className="w-full"
        >
          <ToggleGroupItem value="any" className="flex-1">
            Any size
          </ToggleGroupItem>
          {SIZES.map((size) => (
            <ToggleGroupItem key={size} value={String(size)} className="flex-1">
              ≤ {size.toLocaleString()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Filter by tag">
            {tags.map(({ tag: name }) => {
              const selected = tag?.toLocaleLowerCase() === name.toLocaleLowerCase();
              return (
                <li key={name}>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={selected}
                    className="h-8 rounded-full"
                    onClick={() => setFilters({ tag: selected ? undefined : name })}
                  >
                    {name}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          {pickCandidates(puzzles, {}).length
            ? 'No owned puzzles match these filters.'
            : 'No puzzles waiting on the shelf. Mark some as Owned to pick from them.'}
        </p>
      ) : (
        <>
          <Button
            size="lg"
            className="w-full"
            onClick={() => setPickedId(pickNext(candidates, pickedId)?.id)}
          >
            <DicesIcon aria-hidden />
            {picked ? 'Pick again' : `Pick one of ${candidates.length}`}
          </Button>
          {picked && (
            <section aria-label="Your pick" className="mx-auto max-w-64 space-y-3">
              <PuzzleCard puzzle={picked} />
              <StatusActions puzzle={picked} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

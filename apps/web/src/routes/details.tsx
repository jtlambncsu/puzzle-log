import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Loader2Icon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_DETAILS_BATCH, type DetailsJob } from '@puzzle-log/shared';
import { detailsJobsQueryOptions, puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { detailsCandidates } from '@/features/details/candidates';
import { ProposalCard } from '@/features/details/ProposalCard';

export const Route = createFileRoute('/details')({
  loader: ({ context: { queryClient, api } }) =>
    Promise.all([
      queryClient.ensureQueryData(puzzlesQueryOptions(api)),
      queryClient.ensureQueryData(detailsJobsQueryOptions(api, queryClient)),
    ]),
  component: DetailsPage,
});

/** What finished searches found and cost, to price the next ones on real numbers. */
function measured(jobs: readonly DetailsJob[]) {
  const done = jobs.filter((job) => job.summary);
  const searched = done.reduce((sum, job) => sum + job.processedIds.length, 0);
  const cost = done.reduce((sum, job) => sum + (job.summary?.costUsd ?? 0), 0);
  const found = done.reduce((sum, job) => sum + (job.summary?.found ?? 0), 0);
  return searched ? { searched, found, costPerPuzzle: cost / searched } : undefined;
}

const cents = (usd: number) => `${Math.max(1, Math.round(usd * 100))}¢`;
const dollars = (usd: number) => `$${usd.toFixed(2)}`;

/**
 * Searches the web for puzzles' official title, brand, piece count and barcode, in batches
 * that Anthropic works through in the background, then lists what it found for review.
 */
function DetailsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const { data: jobs } = useSuspenseQuery(detailsJobsQueryOptions(api, queryClient));
  const candidates = detailsCandidates(puzzles, jobs);
  const proposals = puzzles.filter((puzzle) => puzzle.details);
  const running = jobs.filter((job) => job.status === 'processing');
  const stats = measured(jobs);

  const search = useMutation({
    mutationFn: async (count: number) => {
      const ids = candidates.slice(0, count).map((puzzle) => puzzle.id);
      // One batch per 10 puzzles: each request carries the photos.
      for (let i = 0; i < ids.length; i += MAX_DETAILS_BATCH) {
        await api.createDetailsJob(ids.slice(i, i + MAX_DETAILS_BATCH));
      }
      return ids.length;
    },
    onSuccess: (count) => toast.success(`Searching for ${count} puzzles`),
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['detailsJobs'] }),
  });

  const options = stats
    ? [MAX_DETAILS_BATCH, 50].filter((count, i) => i === 0 || candidates.length > count / 2)
    : [MAX_DETAILS_BATCH];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold">Find details online</h1>
        <p className="text-sm text-muted-foreground">
          AI searches puzzle makers' and shops' websites for each puzzle's official title, brand,
          piece count and barcode, comparing their pictures with your photo. Nothing changes until
          you apply it. Searches run in the background and usually finish within an hour.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border p-4" aria-labelledby="search-heading">
        <h2 id="search-heading" className="font-medium">
          {candidates.length
            ? `${candidates.length} ${candidates.length === 1 ? 'puzzle' : 'puzzles'} to search`
            : 'Nothing left to search'}
        </h2>
        {candidates.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {stats
                ? `So far: ${stats.found} of ${stats.searched} found, about ${cents(
                    stats.costPerPuzzle,
                  )} a puzzle.`
                : 'Start with a trial of 10 to see how well it does and what it really costs (roughly 5 to 10¢ a puzzle).'}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((count, i) => {
                const n = Math.min(count, candidates.length);
                return (
                  <Button
                    key={count}
                    variant={i === 0 ? 'default' : 'outline'}
                    disabled={search.isPending}
                    onClick={() => search.mutate(n)}
                  >
                    {search.isPending && search.variables === n ? (
                      <Loader2Icon className="animate-spin" aria-hidden />
                    ) : (
                      <SearchIcon aria-hidden />
                    )}
                    {stats ? `Search ${n}` : `Try ${n}`}
                    {stats && ` (about ${dollars(n * stats.costPerPuzzle)})`}
                  </Button>
                );
              })}
            </div>
          </>
        )}
        {running.length > 0 && (
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Searching for {running.reduce((sum, job) => sum + job.puzzleIds.length, 0)} puzzles. You
            can leave this page; results appear here when they're ready.
          </p>
        )}
      </section>

      {proposals.length > 0 && (
        <section className="space-y-3" aria-labelledby="review-heading">
          <h2 id="review-heading" className="font-medium">
            To review ({proposals.length})
          </h2>
          {proposals.map((puzzle) => (
            <ProposalCard key={puzzle.id} puzzle={puzzle} proposal={puzzle.details!.proposal} />
          ))}
        </section>
      )}

      {jobs.some((job) => job.summary) && (
        <section className="space-y-2" aria-labelledby="history-heading">
          <h2 id="history-heading" className="font-medium">
            Past searches
          </h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {jobs
              .filter((job) => job.summary)
              .map((job) => (
                <li key={job.id}>
                  {new Date(job.createdAt).toLocaleDateString()}: {job.puzzleIds.length} puzzles,{' '}
                  {job.summary!.found} found, {job.summary!.notFound} not found
                  {job.summary!.failed > 0 && `, ${job.summary!.failed} couldn't finish`}, about{' '}
                  {dollars(job.summary!.costUsd)}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

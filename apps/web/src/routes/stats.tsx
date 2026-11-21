import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RankedBars } from '@/features/stats/RankedBars';
import { StatTile } from '@/features/stats/StatTile';
import { YearChart } from '@/features/stats/YearChart';
import { puzzleStats } from '@/lib/stats';

export const Route = createFileRoute('/stats')({
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  component: StatsPage,
});

function StatsPage() {
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const stats = puzzleStats(puzzles);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeftIcon aria-hidden />
          All puzzles
        </Link>
      </Button>
      <h1 className="font-heading text-xl font-semibold">Your puzzle stats</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Puzzles done" value={stats.statusCounts.done} />
        <StatTile label="Pieces placed" value={stats.piecesPlaced} />
        <StatTile label={`Done in ${new Date().getFullYear()}`} value={stats.doneThisYear} />
        <StatTile label="Owned, not done" value={stats.statusCounts.owned} />
        <StatTile label="On the wishlist" value={stats.statusCounts.wishlist} />
      </div>

      {stats.statusCounts.done === 0 ? (
        <p className="text-muted-foreground">Finish a puzzle to see more stats.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Puzzles finished per year</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.perYear.length > 0 ? (
                <YearChart data={stats.perYear} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add finished dates to your puzzles to see them by year.
                </p>
              )}
              {stats.undated > 0 && stats.perYear.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {stats.undated} finished {stats.undated === 1 ? 'puzzle has' : 'puzzles have'} no
                  date and {stats.undated === 1 ? "isn't" : "aren't"} shown.
                </p>
              )}
            </CardContent>
          </Card>

          {stats.topBrands.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Favorite brands</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBars items={stats.topBrands} label="Puzzles finished by brand" />
              </CardContent>
            </Card>
          )}

          {stats.topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top tags</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBars items={stats.topTags} label="Puzzles finished by tag" />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

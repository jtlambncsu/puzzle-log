import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PuzzlePhoto } from '@/features/puzzles/PuzzleCard';
import { Stars } from '@/features/puzzles/StarRating';
import { RankedBars } from '@/features/stats/RankedBars';
import { StatTile } from '@/features/stats/StatTile';
import { YearChart } from '@/features/stats/YearChart';
import { formatDuration } from '@/features/puzzles/format';
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
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Your puzzle stats</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Puzzles done" value={stats.statusCounts.done} />
        <StatTile label="Pieces placed" value={stats.piecesPlaced} />
        <StatTile label={`Done in ${new Date().getFullYear()}`} value={stats.doneThisYear} />
        <StatTile label="In progress" value={stats.statusCounts.in_progress} />
        <StatTile label="Owned, not started" value={stats.statusCounts.owned} />
        <StatTile label="On the wishlist" value={stats.statusCounts.wishlist} />
        {stats.timeSpentMs > 0 && (
          <StatTile label="Time puzzling" value={formatDuration(stats.timeSpentMs)} />
        )}
        {stats.piecesPerHour && (
          <StatTile label="Pieces an hour" value={Math.round(stats.piecesPerHour)} />
        )}
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

          {stats.favorites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Favorites</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.averageRating && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Average rating {stats.averageRating.toFixed(1)} stars
                  </p>
                )}
                <ul className="divide-y" aria-label="Favorite puzzles">
                  {stats.favorites.map((puzzle) => (
                    <li key={puzzle.id}>
                      <Link
                        to="/puzzles/$puzzleId"
                        params={{ puzzleId: puzzle.id }}
                        className="flex items-center gap-3 py-2"
                      >
                        <PuzzlePhoto
                          puzzle={puzzle}
                          className="aspect-square size-12 shrink-0 rounded-md"
                        />
                        <span className="min-w-0 flex-1 truncate">{puzzle.title}</span>
                        <Stars rating={puzzle.rating!} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {stats.paceByDifficulty.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pace by difficulty</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 font-normal">Difficulty</th>
                      <th className="py-1 text-right font-normal">Timed</th>
                      <th className="py-1 text-right font-normal">Pieces an hour</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {stats.paceByDifficulty.map((row) => (
                      <tr key={row.difficulty} className="border-t">
                        <td className="py-1.5 capitalize">{row.difficulty}</td>
                        <td className="py-1.5 text-right">{row.puzzles}</td>
                        <td className="py-1.5 text-right">{Math.round(row.piecesPerHour)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

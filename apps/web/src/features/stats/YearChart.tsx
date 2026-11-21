import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { YearCount } from '@/lib/stats';

const config = {
  count: { label: 'Puzzles', color: 'var(--series-1)' },
} satisfies ChartConfig;

/**
 * Puzzles finished per year: one series, so one color and no legend (the heading names it).
 * Columns are capped at 24px with 4px rounded tops, values sit on the caps while there's room,
 * and hovering or tapping a column shows its tooltip. The same numbers are in a table below.
 */
export function YearChart({ data }: { data: YearCount[] }) {
  const showValues = data.length <= 10;
  return (
    <>
      <ChartContainer config={config} className="aspect-[16/9] w-full">
        <BarChart data={data} margin={{ top: 20, left: -24, right: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} strokeWidth={1} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            // Skip the grow-in animation for people who've asked their device for less motion.
            isAnimationActive={!prefersReducedMotion()}
          >
            {showValues && (
              <LabelList
                dataKey="count"
                position="top"
                className="fill-muted-foreground"
                fontSize={12}
              />
            )}
          </Bar>
        </BarChart>
      </ChartContainer>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-normal">Year</th>
              <th className="text-right font-normal">Puzzles finished</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ year, count }) => (
              <tr key={year}>
                <td>{year}</td>
                <td className="text-right tabular-nums">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

import type { RankedCount } from '@/lib/stats';

/**
 * A ranked list with proportional bars, e.g. top brands. Labels stay readable on a phone
 * (an axis chart would rotate or truncate them), and each value is printed at the bar's tip.
 */
export function RankedBars({ items, label }: { items: RankedCount[]; label: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <ul className="space-y-2" aria-label={label}>
      {items.map((item) => (
        <li key={item.name} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3">
          <span className="truncate text-sm">{item.name}</span>
          <span className="flex items-center gap-2">
            {/* 12px bar, rounded only at its data end; starts square from the baseline. */}
            <span
              className="h-3 rounded-r-[4px] bg-[var(--series-1)]"
              style={{ width: `${(item.count / max) * 85}%` }}
              aria-hidden
            />
            <span className="text-sm text-muted-foreground tabular-nums">{item.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

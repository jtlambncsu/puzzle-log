/** A headline number. Not a chart: one value reads best as a figure. */
export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tabular-nums">
        {new Intl.NumberFormat(undefined, {
          notation: value >= 100_000 ? 'compact' : 'standard',
        }).format(value)}
      </p>
    </div>
  );
}

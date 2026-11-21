import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  CircleCheckBigIcon,
  HeartIcon,
  PackageSearchIcon,
  PlusIcon,
  ScanBarcodeIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizeBarcode, puzzleStatus, type ProductInfo, type Puzzle } from '@puzzle-log/shared';
import { barcodeQueryOptions, puzzlesQueryOptions, useApi, useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PuzzleCard } from '@/features/puzzles/PuzzleCard';
import { PickPuzzle } from '@/features/scan/PickPuzzle';
import { rankBySimilarity } from '@/lib/search';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

export const Route = createFileRoute('/scan/$barcode')({
  // Accept any way of writing the code (UPC-A, EAN-13, spaces) and use the normalized form.
  params: {
    parse: ({ barcode }) => {
      const normalized = normalizeBarcode(barcode);
      if (!normalized) throw notFound();
      return { barcode: normalized };
    },
    stringify: ({ barcode }) => ({ barcode }),
  },
  // Your own list decides "done it?"; the product lookup is extra information, fetched in the
  // component so an exact match shows immediately without waiting for it.
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData(puzzlesQueryOptions(api)),
  component: ScanResultPage,
});

function ScanResultPage() {
  const { barcode } = Route.useParams();
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const exactMatches = puzzles.filter((puzzle) => puzzle.barcode === barcode);
  const online = useOnlineStatus();
  const lookup = useQuery({
    ...barcodeQueryOptions(api, barcode),
    enabled: !exactMatches.length && online,
  });
  const updatePuzzle = useUpdatePuzzle();

  const scanAgain = (
    <Button asChild variant="outline" className="w-full">
      <Link to="/scan">
        <ScanBarcodeIcon aria-hidden />
        Scan another
      </Link>
    </Button>
  );

  if (exactMatches.length > 0) {
    return (
      <div className="space-y-4">
        <MatchVerdict puzzles={exactMatches} />
        <ul className="grid grid-cols-2 gap-3">
          {exactMatches.map((puzzle) => (
            <li key={puzzle.id}>
              <PuzzleCard puzzle={puzzle} />
            </li>
          ))}
        </ul>
        {scanAgain}
      </div>
    );
  }

  const product = lookup.data?.product;
  const suggestions = product
    ? rankBySimilarity(puzzles, [product.title, product.brand].filter(Boolean).join(' '))
    : [];

  return (
    <div className="space-y-6">
      <Verdict tone="new" title="Not in your log yet">
        No saved puzzle has barcode {barcode}.
      </Verdict>

      {!lookup.data && (!online || lookup.fetchStatus === 'paused') ? (
        // Offline: say so instead of spinning. (TanStack Query pauses requests once it sees an
        // "offline" event, but after a fresh page load offline it hasn't seen one.)
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <PackageSearchIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          You're offline, so this box can't be looked up. Search your puzzles below to check by
          name.
        </p>
      ) : lookup.isPending ? (
        <Skeleton className="h-24 w-full rounded-xl" aria-label="Looking up this barcode" />
      ) : product ? (
        <ProductCard product={product} />
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <PackageSearchIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {lookup.isError
            ? "Couldn't look this barcode up right now."
            : "We couldn't identify this box. Search your puzzles below to check by name."}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">
          {suggestions.length > 0 ? 'Is it one of these?' : 'Is it one of yours?'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick it to save this barcode, so scanning this box finds it straight away next time.
        </p>
        <PickPuzzle
          puzzles={puzzles}
          suggestions={suggestions}
          pendingId={updatePuzzle.isPending ? updatePuzzle.variables.id : undefined}
          onPick={(puzzle) =>
            updatePuzzle.mutate(
              { id: puzzle.id, patch: { barcode } },
              {
                onSuccess: () => toast.success(`Saved the barcode on “${puzzle.title}”`),
                onError: (error) => toast.error(error.message),
              },
            )
          }
        />
      </section>

      <div className="space-y-2">
        <Button asChild className="w-full">
          <Link
            to="/puzzles/new"
            search={{
              barcode,
              title: product?.title,
              brand: product?.brand,
              pieces: product?.pieceCount,
            }}
          >
            <PlusIcon aria-hidden />
            Add it as a new puzzle
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link
            to="/puzzles/new"
            search={{
              barcode,
              status: 'wishlist',
              title: product?.title,
              brand: product?.brand,
              pieces: product?.pieceCount,
            }}
          >
            <HeartIcon aria-hidden />
            Add to wishlist
          </Link>
        </Button>
        {scanAgain}
      </div>
    </div>
  );
}

/**
 * What matters in a shop: done it, already own it (don't buy it twice!), or want it.
 * If several puzzles share the barcode, the most "finished" status wins.
 */
function MatchVerdict({ puzzles }: { puzzles: Puzzle[] }) {
  const statuses = new Set(puzzles.map(puzzleStatus));
  const extra = puzzles.length > 1 ? `${puzzles.length} puzzles have this barcode.` : undefined;
  if (statuses.has('done')) {
    return (
      <Verdict tone="done" title="You've done this one">
        {extra}
      </Verdict>
    );
  }
  if (statuses.has('in_progress')) {
    return (
      <Verdict tone="new" title="You're doing this one right now">
        It's on your table. {extra}
      </Verdict>
    );
  }
  if (statuses.has('owned')) {
    return (
      <Verdict tone="new" title="You already own this one">
        It's waiting on your shelf. {extra}
      </Verdict>
    );
  }
  return (
    <Verdict tone="wish" title="It's on your wishlist!">
      Open it and tap “I bought it” once it's yours. {extra}
    </Verdict>
  );
}

function Verdict({
  tone,
  title,
  children,
}: {
  tone: 'done' | 'new' | 'wish';
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = { done: CircleCheckBigIcon, new: TriangleAlertIcon, wish: HeartIcon }[tone];
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-xl p-4 ${
        {
          done: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
          new: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
          wish: 'bg-pink-50 text-pink-900 dark:bg-pink-950 dark:text-pink-100',
        }[tone]
      }`}
    >
      <Icon className="size-8 shrink-0" aria-hidden />
      <div>
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        {children && <p className="text-sm opacity-80">{children}</p>}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: ProductInfo }) {
  return (
    <Card className="flex-row items-center gap-3 p-3" aria-label="Product from barcode">
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt=""
          className="size-20 shrink-0 rounded-md bg-white object-contain"
          referrerPolicy="no-referrer"
          // It's a third-party image; if it doesn't load, show nothing rather than a broken icon.
          onError={(event) => event.currentTarget.remove()}
        />
      )}
      <div className="min-w-0">
        <p className="line-clamp-3 font-medium">{product.title}</p>
        <p className="text-sm text-muted-foreground">
          {[product.brand, product.pieceCount && `${product.pieceCount} pieces`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Card>
  );
}

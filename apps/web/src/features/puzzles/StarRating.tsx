import { StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 1 to 5 stars as a radio group. Tapping the chosen star again clears the rating (0).
 * Big touch targets: each star is a 40px button.
 */
export function StarRating({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div id={id} role="radiogroup" aria-label="Rating" className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(value === star ? 0 : star)}
          className="flex size-10 items-center justify-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <StarIcon
            aria-hidden
            className={cn(
              'size-7 transition-colors',
              star <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** "★★★★☆", for showing a saved rating. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} role="img" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden
          className={cn(
            'size-4',
            star <= rating ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

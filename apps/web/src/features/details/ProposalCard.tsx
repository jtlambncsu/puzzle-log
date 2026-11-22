import { useId, useState } from 'react';
import { CircleAlertIcon, CircleCheckIcon, CircleHelpIcon, ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { BarcodeCheck, DetailsProposal, Puzzle } from '@puzzle-log/shared';
import { useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PuzzlePhoto } from '@/features/puzzles/PuzzleCard';
import {
  applyPatch,
  changedFields,
  defaultSelection,
  newTags,
  type ProposalField,
} from './candidates';

const LABELS: Record<ProposalField, string> = {
  title: 'Title',
  brand: 'Brand',
  pieceCount: 'Pieces',
  barcode: 'Barcode',
  tags: 'Add tags',
};

const BARCODE_CHECK: Record<BarcodeCheck, { label: string; icon: typeof CircleCheckIcon }> = {
  confirmed: { label: 'The barcode database agrees', icon: CircleCheckIcon },
  mismatch: { label: 'The barcode database lists a different product', icon: CircleAlertIcon },
  unverified: { label: "Couldn't double-check this barcode", icon: CircleHelpIcon },
};

/** One puzzle's proposal: pick which fields to apply, then Apply or Dismiss. */
export function ProposalCard({ puzzle, proposal }: { puzzle: Puzzle; proposal: DetailsProposal }) {
  const updatePuzzle = useUpdatePuzzle();
  const [chosen, setChosen] = useState(() => defaultSelection(puzzle, proposal));
  const fields = changedFields(puzzle, proposal);
  const idPrefix = useId();

  function toggle(field: ProposalField, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(field);
    else next.delete(field);
    setChosen(next);
  }

  function save(apply: boolean) {
    updatePuzzle.mutate(
      { id: puzzle.id, patch: apply ? applyPatch(puzzle, proposal, chosen) : { details: null } },
      {
        onSuccess: () => toast.success(apply ? `Updated “${puzzle.title}”` : 'Dismissed'),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function current(field: ProposalField) {
    if (field === 'tags') return null;
    const value = puzzle[field];
    return value === undefined ? 'none' : String(value);
  }

  function proposed(field: ProposalField) {
    if (field === 'tags') return newTags(puzzle, proposal).join(', ');
    return String(proposal[field]);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <PuzzlePhoto puzzle={puzzle} className="aspect-square size-20 shrink-0 rounded-md" />
          <div className="min-w-0">
            <h2 className="truncate font-medium">{puzzle.title}</h2>
            {proposal.note && <p className="text-sm text-muted-foreground">{proposal.note}</p>}
          </div>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing new: your details already match.</p>
        ) : (
          <ul className="space-y-2" aria-label="Proposed changes">
            {fields.map((field) => {
              const id = `${idPrefix}-${field}`;
              const check = field === 'barcode' ? proposal.barcodeCheck : undefined;
              const CheckIcon = check && BARCODE_CHECK[check].icon;
              return (
                <li key={field} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={chosen.has(field)}
                    onCheckedChange={(on) => toggle(field, on === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor={id} className="min-w-0 flex-1">
                    <span className="font-medium">{LABELS[field]}</span>{' '}
                    {current(field) !== null && (
                      <span className="text-muted-foreground line-through">{current(field)}</span>
                    )}{' '}
                    <span className="break-words">{proposed(field)}</span>
                    {check && CheckIcon && (
                      <span
                        className={`mt-0.5 flex items-center gap-1 text-xs ${
                          check === 'mismatch' ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                      >
                        <CheckIcon className="size-3.5" aria-hidden />
                        {BARCODE_CHECK[check].label}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {proposal.sources.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Sources">
            {proposal.sources.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground underline"
                >
                  {hostname(url)}
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={updatePuzzle.isPending || chosen.size === 0}
            onClick={() => save(true)}
          >
            Apply{chosen.size > 0 && fields.length > chosen.size ? ' selected' : ''}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={updatePuzzle.isPending}
            onClick={() => save(false)}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

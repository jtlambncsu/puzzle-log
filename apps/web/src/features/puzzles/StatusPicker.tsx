import { PUZZLE_STATUSES, type PuzzleStatus } from '@puzzle-log/shared';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { STATUS_INFO } from '@/lib/status';

/** Done / In progress / Owned / Wishlist as a segmented control (a radio group for screen readers). */
export function StatusPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: PuzzleStatus;
  onChange: (status: PuzzleStatus) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="outline"
      spacing={0}
      value={value}
      // Radix sends '' when the selected item is pressed again; a status is always required.
      onValueChange={(next) => next && onChange(next as PuzzleStatus)}
      disabled={disabled}
      className="w-full"
    >
      {PUZZLE_STATUSES.map((status) => {
        const { label, shortLabel, icon: Icon } = STATUS_INFO[status];
        return (
          <ToggleGroupItem
            key={status}
            value={status}
            className="flex-1 px-1.5 sm:px-3"
            aria-label={label}
          >
            {/* Four labels only fit a phone's width without their icons. */}
            <Icon aria-hidden className="max-sm:hidden" />
            {shortLabel ? (
              <>
                <span className="sm:hidden">{shortLabel}</span>
                <span className="max-sm:hidden">{label}</span>
              </>
            ) : (
              label
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

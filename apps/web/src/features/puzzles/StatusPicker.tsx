import { PUZZLE_STATUSES, type PuzzleStatus } from '@puzzle-log/shared';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { STATUS_INFO } from '@/lib/status';

/** Done / Owned / Wishlist as a segmented control (a radio group for screen readers). */
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
        const { label, icon: Icon } = STATUS_INFO[status];
        return (
          <ToggleGroupItem key={status} value={status} className="flex-1" aria-label={label}>
            <Icon aria-hidden />
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

import { useState } from 'react';
import { Loader2Icon, RotateCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Puzzle } from '@puzzle-log/shared';
import { useRotatePuzzlePhoto } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { nextRotation, type Rotation } from '@/lib/image';
import { PuzzlePhoto } from './PuzzleCard';

/**
 * A saved puzzle's photo with a rotate button. Rotating only turns the preview; "Save
 * rotation" then rotates the real image once, however many taps it took.
 */
export function RotatablePhoto({ puzzle }: { puzzle: Puzzle }) {
  const [rotation, setRotation] = useState<Rotation>(0);
  const rotatePhoto = useRotatePuzzlePhoto();

  if (!puzzle.imageUrl)
    return <PuzzlePhoto puzzle={puzzle} className="aspect-square rounded-2xl" />;

  async function save() {
    try {
      await rotatePhoto.mutateAsync({ puzzle, rotation });
      setRotation(0); // the new photo is already upright
      toast.success('Photo rotated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not rotate the photo');
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl">
        <PuzzlePhoto puzzle={puzzle} className="aspect-square" rotation={rotation} />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 rounded-full"
          onClick={() => setRotation(nextRotation)}
          disabled={rotatePhoto.isPending}
          aria-label="Rotate photo"
        >
          <RotateCwIcon />
        </Button>
      </div>
      {rotation !== 0 && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void save()} disabled={rotatePhoto.isPending}>
            {rotatePhoto.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
            {rotatePhoto.isPending ? 'Saving…' : 'Save rotation'}
          </Button>
          <Button variant="outline" onClick={() => setRotation(0)} disabled={rotatePhoto.isPending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

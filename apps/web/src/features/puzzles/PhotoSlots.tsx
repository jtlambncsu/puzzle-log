import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImagePlusIcon, Loader2Icon, PackageIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_UPLOAD_BYTES, type Puzzle } from '@puzzle-log/shared';
import { uploadPreparedPhoto, useApi, useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';

type Slot = 'imageKey' | 'boxImageKey';

/**
 * Adding the photos a puzzle doesn't have yet, from its page: the finished photo (say, once
 * a wishlist puzzle is done) and a photo of the box, which can be replaced or removed.
 * Rotating the finished photo stays with the photo itself (RotatablePhoto).
 */
export function PhotoSlots({ puzzle }: { puzzle: Puzzle }) {
  const api = useApi();
  const updatePuzzle = useUpdatePuzzle();
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef<Slot>('imageKey');

  const upload = useMutation({
    mutationFn: async ({ slot, file }: { slot: Slot; file: File }) => {
      const key = await uploadPreparedPhoto(api, file);
      return updatePuzzle.mutateAsync({ id: puzzle.id, patch: { [slot]: key } });
    },
    onSuccess: () => toast.success('Photo saved'),
    onError: (error) => toast.error(error.message),
  });

  function choose(slot: Slot) {
    target.current = slot;
    picker.current?.click();
  }

  function removeBox() {
    updatePuzzle.mutate(
      { id: puzzle.id, patch: { boxImageKey: null } },
      {
        onSuccess: () => toast.success('Box photo removed'),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const busy = upload.isPending || updatePuzzle.isPending;
  // When there's no finished photo, the box already fills the main photo spot above.
  const showBoxThumbnail = puzzle.imageUrl && puzzle.boxImageUrl;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showBoxThumbnail && (
        <img
          src={puzzle.boxImageUrl}
          alt={`Box of ${puzzle.title}`}
          crossOrigin="anonymous"
          className="size-16 rounded-md border object-cover"
        />
      )}
      {!puzzle.imageKey && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => choose('imageKey')}>
          <ImagePlusIcon aria-hidden />
          Add photo
        </Button>
      )}
      {puzzle.boxImageKey ? (
        <>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => choose('boxImageKey')}>
            <RefreshCwIcon aria-hidden />
            Replace box photo
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={removeBox}>
            <Trash2Icon aria-hidden />
            Remove box photo
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => choose('boxImageKey')}>
          <PackageIcon aria-hidden />
          Add box photo
        </Button>
      )}
      {busy && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!file.type.startsWith('image/') || file.size > MAX_UPLOAD_BYTES * 4) {
            toast.error('Choose an image file (not too large)');
            return;
          }
          upload.mutate({ slot: target.current, file });
        }}
      />
    </div>
  );
}

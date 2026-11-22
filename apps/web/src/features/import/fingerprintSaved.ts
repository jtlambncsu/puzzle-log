import type { QueryClient } from '@tanstack/react-query';
import type { Puzzle } from '@puzzle-log/shared';
import type { PuzzlesApi } from '@/api/client';
import { cachePuzzle, downloadPhoto } from '@/api/queries';
import { mapWithConcurrency } from '@/lib/mapWithConcurrency';
import { fingerprintImage, fingerprintToHex } from '@/lib/photoImport';

/** Saved puzzles that have a photo but no fingerprint yet. */
export function needingFingerprints(puzzles: readonly Puzzle[]) {
  return puzzles.filter((puzzle) => puzzle.imageUrl && !puzzle.photoFingerprint);
}

/**
 * Fingerprints saved puzzles' photos, so an import can recognize them: puzzles added before
 * fingerprints existed, added by hand, or whose photo was rotated (which clears it). Each is
 * downloaded once, fingerprinted in the browser and saved, so this only happens once per
 * photo. Failures are skipped: that puzzle just won't be recognized by its look.
 */
export async function fingerprintSavedPhotos(
  api: PuzzlesApi,
  queryClient: QueryClient,
  puzzles: readonly Puzzle[],
  onProgress: () => void,
) {
  // Two at a time, alongside the photos being checked: memory is tight on a phone.
  await mapWithConcurrency(puzzles, 2, async (puzzle) => {
    try {
      const photo = await (await downloadPhoto(puzzle.imageUrl!)).blob();
      const look = await fingerprintImage(photo);
      if (look) {
        const photoFingerprint = fingerprintToHex(look.fingerprints[0]!);
        // Straight to the cache, without refetching the whole list once per puzzle.
        cachePuzzle(queryClient, await api.update(puzzle.id, { photoFingerprint }));
      }
    } catch {
      // skipped: see above
    }
    onProgress();
  });
}

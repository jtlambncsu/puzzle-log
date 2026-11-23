import { zipSync } from 'fflate';
import type { Puzzle } from '@puzzle-log/shared';
import { downloadPhoto } from '@/api/queries';
import { photoFileName } from '@/lib/export';
import { mapWithConcurrency } from '@/lib/mapWithConcurrency';

/**
 * Downloads puzzles' photos and zips them, named as in the spreadsheet's Photo column.
 * Photos are stored, not compressed again: JPEGs don't shrink, and it saves the phone work.
 */
export async function zipPhotos(puzzles: readonly Puzzle[], onProgress: () => void) {
  const files: Record<string, Uint8Array> = {};
  let failed = 0;
  await mapWithConcurrency(puzzles, 4, async (puzzle) => {
    try {
      const res = await downloadPhoto(puzzle.imageUrl!);
      files[photoFileName(puzzle)] = new Uint8Array(await res.arrayBuffer());
    } catch {
      failed++;
    }
    onProgress();
  });
  const zip = zipSync(files, { level: 0 });
  return { blob: new Blob([zip], { type: 'application/zip' }), failed };
}

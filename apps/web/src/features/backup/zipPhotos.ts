import { zipSync } from 'fflate';
import { downloadPhoto } from '@/api/queries';
import type { PhotoEntry } from '@/lib/export';
import { mapWithConcurrency } from '@/lib/mapWithConcurrency';

/**
 * Downloads photos and zips them, named as in the spreadsheet's Photo and Box photo columns.
 * Photos are stored, not compressed again: JPEGs don't shrink, and it saves the phone work.
 */
export async function zipPhotos(entries: readonly PhotoEntry[], onProgress: () => void) {
  const files: Record<string, Uint8Array> = {};
  let failed = 0;
  await mapWithConcurrency(entries, 4, async (entry) => {
    try {
      const res = await downloadPhoto(entry.url);
      files[entry.name] = new Uint8Array(await res.arrayBuffer());
    } catch {
      failed++;
    }
    onProgress();
  });
  const zip = zipSync(files, { level: 0 });
  return { blob: new Blob([zip], { type: 'application/zip' }), failed };
}

import { z } from 'zod';
import { emptyPuzzleForm, puzzleFormSchema, toCreatePuzzleInput } from './puzzleForm';

/** Most photos picked in one go. Keeps memory and upload time reasonable on a phone. */
export const MAX_BULK_PHOTOS = 30;

/** One row: a photo plus the same title / pieces / date rules as the single-puzzle form. */
export const bulkItemSchema = puzzleFormSchema
  .pick({ title: true, pieceCount: true, completedAt: true })
  .extend({ photo: z.instanceof(File) });

export const bulkFormSchema = z.object({
  items: z.array(bulkItemSchema).min(1, 'Pick at least one photo').max(MAX_BULK_PHOTOS),
});

export type BulkItem = z.infer<typeof bulkItemSchema>;
export type BulkFormValues = z.infer<typeof bulkFormSchema>;

export function newBulkItem(photo: File): BulkItem {
  return { photo, title: '', pieceCount: '', completedAt: '' };
}

/** `sharedTags` come from the "Tags for all photos" field and apply to every row. */
export function bulkItemToInput({ photo: _photo, ...fields }: BulkItem, sharedTags: string[] = []) {
  return toCreatePuzzleInput({ ...emptyPuzzleForm, ...fields, tags: sharedTags });
}

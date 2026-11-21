import { z } from 'zod';

export const MAX_TAGS = 20;

/**
 * Removes duplicate tags, ignoring case ("Star Wars" and "star wars" are the same tag) and
 * keeping the first spelling used.
 */
export function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const tagSchema = z
  .string()
  .trim()
  .min(1, 'Tags need some text')
  .max(30, 'Keep tags under 30 characters');

export const tagsSchema = z
  .array(tagSchema)
  .max(MAX_TAGS, `Up to ${MAX_TAGS} tags`)
  .transform(uniqueTags);

const imageKeySchema = z.string().regex(/^uploads\/[\w-]+\/[\w-]+$/, 'Invalid image key');

/**
 * Validation schema for creating a puzzle. Shared between the API (to validate
 * requests) and the clients (to validate forms before submitting).
 */
export const createPuzzleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  brand: z.string().trim().max(100).optional(),
  pieceCount: z.number().int().positive().optional(),
  completedAt: z.iso.date().optional(),
  notes: z.string().max(2000).optional(),
  tags: tagsSchema.optional(),
  /** S3 object key returned by `POST /api/uploads`. */
  imageKey: imageKeySchema.optional(),
});

export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

const { title, brand, pieceCount, completedAt, notes, tags } = createPuzzleSchema.shape;

/**
 * Changes to an existing puzzle (`PATCH /api/puzzles/:id`), following JSON Merge Patch
 * (RFC 7396): an omitted field is left as it is, and `null` removes an optional field.
 * At least one field is required.
 */
export const updatePuzzleSchema = z
  .object({
    title: title.optional(),
    brand: brand.unwrap().nullable().optional(),
    pieceCount: pieceCount.unwrap().nullable().optional(),
    completedAt: completedAt.unwrap().nullable().optional(),
    notes: notes.unwrap().nullable().optional(),
    tags: tags.unwrap().nullable().optional(),
    imageKey: imageKeySchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');

export type UpdatePuzzleInput = z.infer<typeof updatePuzzleSchema>;

export interface Puzzle extends CreatePuzzleInput {
  id: string;
  /** The Cognito user (`sub`) who owns this puzzle. */
  userId: string;
  createdAt: string;
  /** Short-lived URL for viewing the photo, added by the API when `imageKey` is set. */
  imageUrl?: string;
}

export const createUploadSchema = z.object({
  contentType: z.string().regex(/^image\/[\w.+-]+$/, 'Only images can be uploaded'),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

/**
 * A presigned S3 POST. Send a multipart form to `url` with every entry of `fields`,
 * then the file as a final field named `file`.
 */
export interface UploadTarget {
  key: string;
  url: string;
  fields: Record<string, string>;
}

/** Largest photo the API will issue an upload for. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

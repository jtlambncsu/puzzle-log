import { z } from 'zod';

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
  /** S3 object key returned by `POST /api/uploads`. */
  imageKey: z
    .string()
    .regex(/^uploads\/[\w-]+$/, 'Invalid image key')
    .optional(),
});

export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

export interface Puzzle extends CreatePuzzleInput {
  id: string;
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

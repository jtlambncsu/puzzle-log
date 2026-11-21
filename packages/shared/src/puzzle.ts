import { z } from 'zod';
import { barcodeSchema } from './barcode.js';

/**
 * Where a puzzle stands: finished, being worked on, owned but not started (on the shelf), or
 * wanted. Puzzles saved before statuses existed have none and count as done.
 */
export const PUZZLE_STATUSES = ['done', 'in_progress', 'owned', 'wishlist'] as const;
export type PuzzleStatus = (typeof PUZZLE_STATUSES)[number];
export const statusSchema = z.enum(PUZZLE_STATUSES);

export function puzzleStatus(puzzle: { status?: PuzzleStatus }): PuzzleStatus {
  return puzzle.status ?? 'done';
}

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

/**
 * Most timer sessions one puzzle can have, far more than any real puzzle needs. A session is
 * about 70 bytes of JSON, so a full list fits the API's 100 KB request limit and DynamoDB's
 * 400 KB item limit.
 */
export const MAX_SESSIONS = 1000;

/** One stretch of work on a puzzle: from pressing Start to pressing Pause (UTC timestamps). */
export const timerSessionSchema = z
  .object({ start: z.iso.datetime(), end: z.iso.datetime() })
  .refine(
    ({ start, end }) => Date.parse(end) > Date.parse(start),
    'A session must end after it starts',
  );

export type TimerSession = z.infer<typeof timerSessionSchema>;

export const sessionsSchema = z.array(timerSessionSchema).max(MAX_SESSIONS);

const imageKeySchema = z.string().regex(/^uploads\/[\w-]+\/[\w-]+$/, 'Invalid image key');

/**
 * Validation schema for creating a puzzle. Shared between the API (to validate
 * requests) and the clients (to validate forms before submitting).
 */
export const createPuzzleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  status: statusSchema.optional(),
  brand: z.string().trim().max(100).optional(),
  pieceCount: z.number().int().positive().optional(),
  /** The day work began (the user's local date). */
  startedAt: z.iso.date().optional(),
  completedAt: z.iso.date().optional(),
  notes: z.string().max(2000).optional(),
  tags: tagsSchema.optional(),
  /** Product barcode (normalized to 13 digits), for scanning boxes in a shop. */
  barcode: barcodeSchema.optional(),
  /** Finished timer sessions. Added by the timer; editable to fix a forgotten Pause. */
  sessions: sessionsSchema.optional(),
  /** S3 object key returned by `POST /api/uploads`. */
  imageKey: imageKeySchema.optional(),
});

export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

const { title, brand, pieceCount, startedAt, completedAt, notes, tags, barcode, sessions } =
  createPuzzleSchema.shape;

/**
 * Changes to an existing puzzle (`PATCH /api/puzzles/:id`), following JSON Merge Patch
 * (RFC 7396): an omitted field is left as it is, and `null` removes an optional field.
 * At least one field is required.
 */
export const updatePuzzleSchema = z
  .object({
    title: title.optional(),
    status: statusSchema.optional(),
    brand: brand.unwrap().nullable().optional(),
    pieceCount: pieceCount.unwrap().nullable().optional(),
    startedAt: startedAt.unwrap().nullable().optional(),
    completedAt: completedAt.unwrap().nullable().optional(),
    notes: notes.unwrap().nullable().optional(),
    tags: tags.unwrap().nullable().optional(),
    barcode: barcode.unwrap().nullable().optional(),
    sessions: sessions.unwrap().nullable().optional(),
    imageKey: imageKeySchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');

export type UpdatePuzzleInput = z.infer<typeof updatePuzzleSchema>;

export interface Puzzle extends CreatePuzzleInput {
  id: string;
  /** The Cognito user (`sub`) who owns this puzzle. */
  userId: string;
  createdAt: string;
  /**
   * When the running timer was started (UTC), or absent when it isn't running. Only the API
   * sets this, using its own clock, through the timer endpoints.
   */
  timerStartedAt?: string;
  /** Short-lived URL for viewing the photo, added by the API when `imageKey` is set. */
  imageUrl?: string;
}

export const createUploadSchema = z.object({
  contentType: z.string().regex(/^image\/[\w.+-]+$/, 'Only images can be uploaded'),
});

/** Body of `POST /api/puzzles/:id/timer/start`. */
export const startTimerSchema = z.object({
  /** The user's local date, recorded as the start date if the puzzle doesn't have one. */
  today: z.iso.date(),
});

export type StartTimerInput = z.infer<typeof startTimerSchema>;

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

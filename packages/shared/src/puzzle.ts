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

/** How hard a finished puzzle was, in the owner's opinion. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const difficultySchema = z.enum(DIFFICULTIES);

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

/** SHA-256 (hex) of an imported photo file, to skip it if it's imported again. */
export const importHashSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Invalid import hash');

/**
 * How the puzzle's photo looks, as a 64-bit difference hash in hex (see the web app's
 * `photoImport.ts`). Lets an import skip photos of puzzles already in the log, even when the
 * file isn't byte-for-byte the same.
 */
export const photoFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{16}$/, 'Invalid photo fingerprint');

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
  /** How the owner liked it, 1 to 5 stars. */
  rating: z.number().int().min(1).max(5).optional(),
  difficulty: difficultySchema.optional(),
  /** Pieces missing from the box, if any were. */
  missingPieces: z.number().int().min(0).max(10_000).optional(),
  wouldRedo: z.boolean().optional(),
  tags: tagsSchema.optional(),
  /** Product barcode (normalized to 13 digits), for scanning boxes in a shop. */
  barcode: barcodeSchema.optional(),
  /** Finished timer sessions. Added by the timer; editable to fix a forgotten Pause. */
  sessions: sessionsSchema.optional(),
  /** S3 object key returned by `POST /api/uploads`: the finished puzzle. */
  imageKey: imageKeySchema.optional(),
  /** A photo of the box, e.g. for a puzzle not started yet. Same kind of key. */
  boxImageKey: imageKeySchema.optional(),
  /** Imported in bulk and not checked by the user yet (see the review screen). */
  needsReview: z.literal(true).optional(),
  /** The photo files this puzzle came from (a merged duplicate adds its own). */
  importHashes: z.array(importHashSchema).max(50).optional(),
  photoFingerprint: photoFingerprintSchema.optional(),
});

export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

const {
  title,
  brand,
  pieceCount,
  startedAt,
  completedAt,
  notes,
  rating,
  difficulty,
  missingPieces,
  wouldRedo,
  tags,
  barcode,
  sessions,
  needsReview,
  importHashes,
  photoFingerprint,
} = createPuzzleSchema.shape;

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
    rating: rating.unwrap().nullable().optional(),
    difficulty: difficulty.unwrap().nullable().optional(),
    missingPieces: missingPieces.unwrap().nullable().optional(),
    wouldRedo: wouldRedo.unwrap().nullable().optional(),
    tags: tags.unwrap().nullable().optional(),
    barcode: barcode.unwrap().nullable().optional(),
    sessions: sessions.unwrap().nullable().optional(),
    needsReview: needsReview.unwrap().nullable().optional(),
    importHashes: importHashes.unwrap().nullable().optional(),
    photoFingerprint: photoFingerprint.unwrap().nullable().optional(),
    imageKey: imageKeySchema.optional(),
    boxImageKey: imageKeySchema.nullable().optional(),
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
  /** The same for `boxImageKey`. */
  boxImageUrl?: string;
}

/** `POST /api/suggestions/tags`: AI tag ideas from what's known about a puzzle. */
export const suggestTagsSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    brand: z.string().trim().max(100).optional(),
    /** Photos already uploaded (the finished puzzle and/or its box). */
    imageKeys: z.array(imageKeySchema).max(2).default([]),
  })
  .refine(
    (input) => input.title || input.imageKeys.length,
    'A title or a photo is needed to suggest tags',
  );

export type SuggestTagsInput = z.input<typeof suggestTagsSchema>;

export interface SuggestTagsResult {
  tags: string[];
}

/** `POST /api/suggestions/box`: reads what's printed on a box photo already uploaded. */
export const readBoxSchema = z.object({ imageKey: imageKeySchema });

export type ReadBoxInput = z.input<typeof readBoxSchema>;

/** What could be read off the box. Anything not legible is left out. */
export interface BoxDetails {
  title?: string;
  brand?: string;
  pieceCount?: number;
}

export const createUploadSchema = z.object({
  contentType: z.string().regex(/^image\/[\w.+-]+$/, 'Only images can be uploaded'),
});

/** What AI suggests for an imported puzzle, from its photo. */
export interface PuzzleSuggestion {
  title: string;
  brand?: string;
  tags: string[];
}

/** Title an imported puzzle has until it's named (by AI or by hand). */
export const IMPORTED_TITLE = 'Imported puzzle';

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

import { z } from 'zod';
import {
  createPuzzleSchema,
  difficultySchema,
  MAX_TAGS,
  normalizeBarcode,
  puzzleStatus,
  statusSchema,
  tagSchema,
  type CreatePuzzleInput,
  type Puzzle,
  type UpdatePuzzleInput,
} from '@puzzle-log/shared';

const { title, brand, notes } = createPuzzleSchema.shape;

/**
 * What the form holds. HTML inputs always produce strings (an empty number input is ''),
 * so the form has its own schema and converts to the API's `CreatePuzzleInput` on submit.
 * Rules shared with the API (title, brand and notes limits) come from the shared schema,
 * so the client and server can't drift apart.
 */
export const puzzleFormSchema = z.object({
  title,
  status: statusSchema,
  brand: brand.unwrap(),
  pieceCount: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[1-9]\d{0,5}$/.test(value), 'Enter a whole number'),
  startedAt: z.string(),
  completedAt: z.string(),
  notes: notes.unwrap(),
  /** 0 means not rated. */
  rating: z.number().int().min(0).max(5),
  difficulty: z.union([difficultySchema, z.literal('')]),
  missingPieces: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{1,5}$/.test(value), 'Enter a whole number'),
  /** '' means not answered. */
  wouldRedo: z.enum(['', 'yes', 'no']),
  tags: z.array(tagSchema).max(MAX_TAGS),
  barcode: z
    .string()
    .trim()
    .refine((value) => !value || normalizeBarcode(value), 'Not a valid barcode'),
});

export type PuzzleFormValues = z.infer<typeof puzzleFormSchema>;

export const emptyPuzzleForm: PuzzleFormValues = {
  title: '',
  status: 'done',
  brand: '',
  pieceCount: '',
  startedAt: '',
  completedAt: '',
  notes: '',
  rating: 0,
  difficulty: '',
  missingPieces: '',
  wouldRedo: '',
  tags: [],
  barcode: '',
};

export function hasStarted(status: PuzzleFormValues['status']) {
  return status === 'in_progress' || status === 'done';
}

/** Fills the form from a saved puzzle, for editing. */
export function puzzleToFormValues(puzzle: Puzzle): PuzzleFormValues {
  return {
    title: puzzle.title,
    status: puzzleStatus(puzzle),
    brand: puzzle.brand ?? '',
    pieceCount: puzzle.pieceCount ? String(puzzle.pieceCount) : '',
    startedAt: puzzle.startedAt ?? '',
    completedAt: puzzle.completedAt ?? '',
    notes: puzzle.notes ?? '',
    rating: puzzle.rating ?? 0,
    difficulty: puzzle.difficulty ?? '',
    missingPieces: puzzle.missingPieces === undefined ? '' : String(puzzle.missingPieces),
    wouldRedo: puzzle.wouldRedo === undefined ? '' : puzzle.wouldRedo ? 'yes' : 'no',
    tags: puzzle.tags ?? [],
    barcode: puzzle.barcode ?? '',
  };
}

/** Blank fields become `undefined` so they're left out of the saved puzzle. */
export function toCreatePuzzleInput(values: PuzzleFormValues): CreatePuzzleInput {
  return createPuzzleSchema.parse({
    title: values.title,
    status: values.status,
    brand: values.brand.trim() || undefined,
    pieceCount: values.pieceCount ? Number(values.pieceCount) : undefined,
    // Only puzzles that were started have a start date, and only finished ones an end date.
    startedAt: (hasStarted(values.status) && values.startedAt) || undefined,
    completedAt: (values.status === 'done' && values.completedAt) || undefined,
    notes: values.notes.trim() || undefined,
    // How it went only applies to finished puzzles.
    ...(values.status === 'done' && {
      rating: values.rating || undefined,
      difficulty: values.difficulty || undefined,
      missingPieces: values.missingPieces ? Number(values.missingPieces) : undefined,
      wouldRedo: values.wouldRedo ? values.wouldRedo === 'yes' : undefined,
    }),
    tags: values.tags.length ? values.tags : undefined,
    barcode: values.barcode || undefined,
  });
}

/**
 * The edit form sends every field, as a JSON Merge Patch: a field left blank becomes `null`,
 * which removes it from the saved puzzle.
 */
export function toUpdatePuzzleInput(values: PuzzleFormValues): UpdatePuzzleInput {
  const input = toCreatePuzzleInput(values);
  return {
    title: input.title,
    status: input.status,
    brand: input.brand ?? null,
    pieceCount: input.pieceCount ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    notes: input.notes ?? null,
    rating: input.rating ?? null,
    difficulty: input.difficulty ?? null,
    missingPieces: input.missingPieces ?? null,
    wouldRedo: input.wouldRedo ?? null,
    tags: input.tags ?? null,
    barcode: input.barcode ?? null,
  };
}

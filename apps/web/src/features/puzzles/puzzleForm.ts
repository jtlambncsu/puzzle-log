import { z } from 'zod';
import {
  createPuzzleSchema,
  MAX_TAGS,
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
  brand: brand.unwrap(),
  pieceCount: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[1-9]\d{0,5}$/.test(value), 'Enter a whole number'),
  completedAt: z.string(),
  notes: notes.unwrap(),
  tags: z.array(tagSchema).max(MAX_TAGS),
});

export type PuzzleFormValues = z.infer<typeof puzzleFormSchema>;

export const emptyPuzzleForm: PuzzleFormValues = {
  title: '',
  brand: '',
  pieceCount: '',
  completedAt: '',
  notes: '',
  tags: [],
};

/** Fills the form from a saved puzzle, for editing. */
export function puzzleToFormValues(puzzle: Puzzle): PuzzleFormValues {
  return {
    title: puzzle.title,
    brand: puzzle.brand ?? '',
    pieceCount: puzzle.pieceCount ? String(puzzle.pieceCount) : '',
    completedAt: puzzle.completedAt ?? '',
    notes: puzzle.notes ?? '',
    tags: puzzle.tags ?? [],
  };
}

/** Blank fields become `undefined` so they're left out of the saved puzzle. */
export function toCreatePuzzleInput(values: PuzzleFormValues): CreatePuzzleInput {
  return createPuzzleSchema.parse({
    title: values.title,
    brand: values.brand.trim() || undefined,
    pieceCount: values.pieceCount ? Number(values.pieceCount) : undefined,
    completedAt: values.completedAt || undefined,
    notes: values.notes.trim() || undefined,
    tags: values.tags.length ? values.tags : undefined,
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
    brand: input.brand ?? null,
    pieceCount: input.pieceCount ?? null,
    completedAt: input.completedAt ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? null,
  };
}

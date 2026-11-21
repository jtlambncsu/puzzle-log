import { z } from 'zod';
import { createPuzzleSchema, type CreatePuzzleInput } from '@puzzle-log/shared';

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
});

export type PuzzleFormValues = z.infer<typeof puzzleFormSchema>;

export const emptyPuzzleForm: PuzzleFormValues = {
  title: '',
  brand: '',
  pieceCount: '',
  completedAt: '',
  notes: '',
};

/** Blank fields become `undefined` so they're left out of the saved puzzle. */
export function toCreatePuzzleInput(values: PuzzleFormValues): CreatePuzzleInput {
  return createPuzzleSchema.parse({
    title: values.title,
    brand: values.brand.trim() || undefined,
    pieceCount: values.pieceCount ? Number(values.pieceCount) : undefined,
    completedAt: values.completedAt || undefined,
    notes: values.notes.trim() || undefined,
  });
}

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
});

export type CreatePuzzleInput = z.infer<typeof createPuzzleSchema>;

export interface Puzzle extends CreatePuzzleInput {
  id: string;
  createdAt: string;
  /** Will hold an S3 URL once photo uploads are added. */
  imageUrl?: string;
}

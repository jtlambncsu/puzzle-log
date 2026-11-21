import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { IMPORTED_TITLE, type Puzzle, type UpdatePuzzleInput } from '@puzzle-log/shared';
import { useAllTags } from '@/api/queries';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { puzzleFormSchema } from '@/features/puzzles/puzzleForm';
import { TagInput } from '@/features/puzzles/TagInput';

/** The review form checks a subset of the full puzzle form, with the same rules. */
const reviewSchema = puzzleFormSchema.pick({
  title: true,
  brand: true,
  pieceCount: true,
  completedAt: true,
  tags: true,
});

type ReviewValues = typeof reviewSchema._input;

/** What the review saves, as a merge patch (blank fields are removed). */
export type ReviewedValues = Pick<
  UpdatePuzzleInput,
  'title' | 'brand' | 'pieceCount' | 'completedAt' | 'tags'
>;

export function ReviewForm({
  puzzle,
  suggesting,
  suggestionFailed,
  onRetrySuggestion,
  busy,
  onSave,
  onSkip,
  onDelete,
}: {
  puzzle: Puzzle;
  suggesting: boolean;
  suggestionFailed: boolean;
  onRetrySuggestion: () => void;
  busy: boolean;
  onSave: (values: ReviewedValues) => void;
  onSkip: () => void;
  onDelete: () => void;
}) {
  const allTags = useAllTags();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      // The placeholder title isn't worth keeping: leave the field empty to type into.
      title: puzzle.title === IMPORTED_TITLE ? '' : puzzle.title,
      brand: puzzle.brand ?? '',
      pieceCount: puzzle.pieceCount ? String(puzzle.pieceCount) : '',
      completedAt: puzzle.completedAt ?? '',
      tags: puzzle.tags ?? [],
    },
  });
  const disabled = busy || suggesting;

  return (
    <form
      noValidate
      aria-label="Review puzzle"
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        onSave({
          title: values.title,
          brand: values.brand.trim() || null,
          pieceCount: values.pieceCount ? Number(values.pieceCount) : null,
          completedAt: values.completedAt || null,
          tags: values.tags.length ? values.tags : null,
        }),
      )}
    >
      {suggesting && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Suggesting a title and tags…
        </p>
      )}
      {suggestionFailed && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          Couldn't suggest a title, so type one.
          <Button type="button" variant="link" className="h-auto p-0" onClick={onRetrySuggestion}>
            <SparklesIcon aria-hidden />
            Try again
          </Button>
        </p>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="review-title">Title</FieldLabel>
          <Input
            id="review-title"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Field data-invalid={!!errors.tags}>
          <FieldLabel htmlFor="review-tags">Tags</FieldLabel>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagInput
                id="review-tags"
                value={field.value}
                onChange={field.onChange}
                suggestions={allTags}
                disabled={disabled}
              />
            )}
          />
          <FieldError errors={[errors.tags]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.pieceCount}>
            <FieldLabel htmlFor="review-pieces">Pieces</FieldLabel>
            <Input
              id="review-pieces"
              inputMode="numeric"
              placeholder="1000"
              disabled={disabled}
              aria-invalid={!!errors.pieceCount}
              {...register('pieceCount')}
            />
            <FieldError errors={[errors.pieceCount]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="review-finished">Finished on</FieldLabel>
            <Input
              id="review-finished"
              type="date"
              disabled={disabled}
              {...register('completedAt')}
            />
          </Field>
        </div>

        <Field data-invalid={!!errors.brand}>
          <FieldLabel htmlFor="review-brand">Brand</FieldLabel>
          <Input id="review-brand" disabled={disabled} {...register('brand')} />
          <FieldError errors={[errors.brand]} />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={disabled}>
        {busy && <Loader2Icon className="animate-spin" aria-hidden />}
        Save &amp; next
      </Button>
      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
          Skip for now
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive" disabled={busy}>
              <Trash2Icon aria-hidden />
              Not a puzzle
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this one?</AlertDialogTitle>
              <AlertDialogDescription>
                It's removed from your puzzles, with its uploaded photo. The photo in your camera
                roll isn't touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}

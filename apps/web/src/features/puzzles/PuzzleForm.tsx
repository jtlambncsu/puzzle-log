import { useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlusIcon, Loader2Icon, RotateCwIcon, XIcon } from 'lucide-react';
import { MAX_UPLOAD_BYTES } from '@puzzle-log/shared';
import { useAllTags } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { nextRotation, type Rotation } from '@/lib/image';
import { readPhotoDate } from '@/lib/photoDate';
import { PhotoPreview } from './PhotoPreview';
import { emptyPuzzleForm, hasStarted, puzzleFormSchema, type PuzzleFormValues } from './puzzleForm';
import { StatusPicker } from './StatusPicker';
import { TagInput } from './TagInput';

interface PuzzleFormProps {
  onSubmit: (values: PuzzleFormValues, photo?: File, rotation?: Rotation) => Promise<unknown>;
  submitLabel?: string;
  /** Start from a saved puzzle (editing) instead of a blank form. */
  defaultValues?: PuzzleFormValues;
  /** Show the photo picker. Off when editing: photos are rotated on the detail page. */
  withPhoto?: boolean;
}

/**
 * Add-puzzle form. React Hook Form keeps inputs uncontrolled (registered by ref), so typing
 * doesn't re-render the whole form, and validates with the Zod schema on submit and then
 * on every change once a field has an error.
 */
export function PuzzleForm({
  onSubmit,
  submitLabel = 'Save puzzle',
  defaultValues = emptyPuzzleForm,
  withPhoto = true,
}: PuzzleFormProps) {
  const tagSuggestions = useAllTags();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PuzzleFormValues>({
    resolver: zodResolver(puzzleFormSchema),
    defaultValues,
  });
  // Re-render only when status changes, to show "Finished on" just for finished puzzles.
  const status = useWatch({ control, name: 'status' });
  const [photo, setPhoto] = useState<File>();
  const [photoError, setPhotoError] = useState<string>();
  const [rotation, setRotation] = useState<Rotation>(0);
  // The date we filled in from the photo, so we can label it and clear it with the photo.
  const [photoDate, setPhotoDate] = useState<string>();

  // Reading EXIF is async; ignore the result if the photo changed in the meantime.
  const latestPhoto = useRef<File>(undefined);

  async function fillDateFromPhoto(file: File) {
    const date = await readPhotoDate(file);
    if (latestPhoto.current !== file) return;
    // Never overwrite a date the user typed (or one from an earlier photo they kept).
    if (date && !getValues('completedAt')) {
      setValue('completedAt', date, { shouldDirty: true });
      setPhotoDate(date);
    }
  }

  const submit = handleSubmit((values) => onSubmit(values, photo, rotation));

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {withPhoto && (
        <PhotoPicker
          photo={photo}
          rotation={rotation}
          onRotate={() => setRotation(nextRotation)}
          error={photoError}
          onChange={(file) => {
            setPhotoError(undefined);
            setRotation(0);
            if (file && !file.type.startsWith('image/')) {
              setPhotoError('Choose an image file');
              return;
            }
            // Photos are compressed before upload, so only reject truly huge originals.
            if (file && file.size > MAX_UPLOAD_BYTES * 4) {
              setPhotoError('That photo is too large');
              return;
            }
            setPhoto(file);
            latestPhoto.current = file;
            if (file) {
              void fillDateFromPhoto(file);
            } else if (photoDate && getValues('completedAt') === photoDate) {
              // Removing the photo also removes the date that came from it.
              setValue('completedAt', '');
              setPhotoDate(undefined);
            }
          }}
        />
      )}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <StatusPicker id="status" value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>

        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            placeholder="Starry Night"
            autoComplete="off"
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.pieceCount}>
            <FieldLabel htmlFor="pieceCount">Pieces</FieldLabel>
            <Input
              id="pieceCount"
              inputMode="numeric"
              placeholder="1000"
              aria-invalid={!!errors.pieceCount}
              {...register('pieceCount')}
            />
            <FieldError errors={[errors.pieceCount]} />
          </Field>

          {hasStarted(status) && (
            <Field data-invalid={!!errors.startedAt}>
              <FieldLabel htmlFor="startedAt">Started on</FieldLabel>
              <Input id="startedAt" type="date" {...register('startedAt')} />
              <FieldError errors={[errors.startedAt]} />
            </Field>
          )}

          {status === 'done' && (
            <Field data-invalid={!!errors.completedAt}>
              <FieldLabel htmlFor="completedAt">Finished on</FieldLabel>
              <Input
                id="completedAt"
                type="date"
                {...register('completedAt', {
                  // Once the user edits the date, it's theirs, not the photo's.
                  onChange: () => setPhotoDate(undefined),
                })}
              />
              {photoDate && <FieldDescription>Date from photo</FieldDescription>}
              <FieldError errors={[errors.completedAt]} />
            </Field>
          )}
        </div>

        <Field data-invalid={!!errors.brand}>
          <FieldLabel htmlFor="brand">Brand</FieldLabel>
          <Input
            id="brand"
            placeholder="Ravensburger"
            aria-invalid={!!errors.brand}
            {...register('brand')}
          />
          <FieldError errors={[errors.brand]} />
        </Field>

        <Field data-invalid={!!errors.tags}>
          <FieldLabel htmlFor="tags">Tags</FieldLabel>
          {/* Not a native input, so it's connected with a Controller instead of register. */}
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagInput
                id="tags"
                value={field.value}
                onChange={field.onChange}
                suggestions={tagSuggestions}
              />
            )}
          />
          <FieldError errors={[errors.tags]} />
        </Field>

        <Field data-invalid={!!errors.barcode}>
          <FieldLabel htmlFor="barcode">Barcode</FieldLabel>
          <Input
            id="barcode"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Number under the barcode on the box"
            aria-invalid={!!errors.barcode}
            {...register('barcode')}
          />
          <FieldError errors={[errors.barcode]} />
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Tricky sky section…"
            aria-invalid={!!errors.notes}
            {...register('notes')}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function PhotoPicker({
  photo,
  rotation,
  onRotate,
  error,
  onChange,
}: {
  photo?: File;
  rotation: Rotation;
  onRotate: () => void;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  const inputId = useId();

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={inputId}>Photo</FieldLabel>
      {photo ? (
        <div className="relative">
          <PhotoPreview file={photo} rotation={rotation} />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={onRotate}
              aria-label="Rotate photo"
            >
              <RotateCwIcon />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={() => onChange(undefined)}
              aria-label="Remove photo"
            >
              <XIcon />
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <ImagePlusIcon className="size-8" aria-hidden />
          <span className="text-sm">Take or choose a photo</span>
        </label>
      )}
      {/* No `capture` attribute: phones then offer both the camera and the photo library. */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.files?.[0]);
          event.target.value = ''; // allow picking the same file again after removing it
        }}
      />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

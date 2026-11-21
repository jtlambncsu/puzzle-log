import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlusIcon, Loader2Icon, XIcon } from 'lucide-react';
import { MAX_UPLOAD_BYTES, type CreatePuzzleInput } from '@puzzle-log/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  emptyPuzzleForm,
  puzzleFormSchema,
  toCreatePuzzleInput,
  type PuzzleFormValues,
} from './puzzleForm';

interface PuzzleFormProps {
  onSubmit: (input: CreatePuzzleInput, photo?: File) => Promise<unknown>;
  submitLabel?: string;
}

/**
 * Add-puzzle form. React Hook Form keeps inputs uncontrolled (registered by ref), so typing
 * doesn't re-render the whole form, and validates with the Zod schema on submit and then
 * on every change once a field has an error.
 */
export function PuzzleForm({ onSubmit, submitLabel = 'Save puzzle' }: PuzzleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PuzzleFormValues>({
    resolver: zodResolver(puzzleFormSchema),
    defaultValues: emptyPuzzleForm,
  });
  const [photo, setPhoto] = useState<File>();
  const [photoError, setPhotoError] = useState<string>();

  const submit = handleSubmit((values) => onSubmit(toCreatePuzzleInput(values), photo));

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <PhotoPicker
        photo={photo}
        error={photoError}
        onChange={(file) => {
          setPhotoError(undefined);
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
        }}
      />

      <FieldGroup>
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

          <Field data-invalid={!!errors.completedAt}>
            <FieldLabel htmlFor="completedAt">Finished on</FieldLabel>
            <Input id="completedAt" type="date" {...register('completedAt')} />
            <FieldError errors={[errors.completedAt]} />
          </Field>
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
  error,
  onChange,
}: {
  photo?: File;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  const inputId = useId();

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={inputId}>Photo</FieldLabel>
      {photo ? (
        <div className="relative">
          <PhotoPreview file={photo} />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 rounded-full"
            onClick={() => onChange(undefined)}
            aria-label="Remove photo"
          >
            <XIcon />
          </Button>
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

/**
 * Previews a local file. The object URL is a browser resource that must be released, so it's
 * created and revoked in an effect and set on the <img> through a ref: no extra state or
 * re-render, and it stays correct when StrictMode runs effects twice in development.
 */
function PhotoPreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <img
      ref={imgRef}
      alt="Selected puzzle photo"
      className="aspect-square w-full rounded-xl bg-muted object-cover"
    />
  );
}

import { useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  ImagePlusIcon,
  Loader2Icon,
  RotateCwIcon,
  ScanTextIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { DIFFICULTIES, MAX_TAGS, MAX_UPLOAD_BYTES, uniqueTags } from '@puzzle-log/shared';
import { uploadPreparedPhoto, useAllTags, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { nextRotation, type Rotation } from '@/lib/image';
import { readPhotoDate } from '@/lib/photoDate';
import { PhotoPreview } from './PhotoPreview';
import { emptyPuzzleForm, hasStarted, puzzleFormSchema, type PuzzleFormValues } from './puzzleForm';
import { StarRating } from './StarRating';
import { StatusPicker } from './StatusPicker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TagInput } from './TagInput';

/** The photos chosen in the form, and keys of any already uploaded (for tag suggestions). */
export interface FormPhotos {
  photo?: File;
  rotation: Rotation;
  boxPhoto?: File;
  /** Set when `photo` (as rotated) was already uploaded: reuse it instead of uploading again. */
  imageKey?: string;
  boxImageKey?: string;
}

interface PuzzleFormProps {
  onSubmit: (values: PuzzleFormValues, photos: FormPhotos) => Promise<unknown>;
  submitLabel?: string;
  /** Start from a saved puzzle (editing) instead of a blank form. */
  defaultValues?: PuzzleFormValues;
  /** Show the photo pickers. Off when editing: photos are managed on the detail page. */
  withPhoto?: boolean;
  /** When editing: the saved puzzle's photos, which tag suggestions look at. */
  savedImageKeys?: string[];
  /** When editing: the saved box photo, which "Fill in from box" reads. */
  savedBoxImageKey?: string;
}

/** The form fields a box photo can fill in, with how a toast names them. */
const BOX_FIELDS = [
  ['title', 'title'],
  ['brand', 'brand'],
  ['pieceCount', 'pieces'],
] as const;

/** Identifies a chosen photo as uploaded (rotation changes the uploaded pixels). */
const uploadKey = (file: File, rotation: Rotation) =>
  `${file.name}|${file.size}|${file.lastModified}|${rotation}`;

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
  savedImageKeys = [],
  savedBoxImageKey,
}: PuzzleFormProps) {
  const api = useApi();
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
  const [boxPhoto, setBoxPhoto] = useState<File>();
  const [boxPhotoError, setBoxPhotoError] = useState<string>();
  // Photos uploaded so AI could look at them, reused when saving.
  const uploaded = useRef(new Map<string, string>());
  const title = useWatch({ control, name: 'title' });

  async function uploadOnce(file: File, turn: Rotation) {
    const key = uploadKey(file, turn);
    const known = uploaded.current.get(key);
    if (known) return known;
    const imageKey = await uploadPreparedPhoto(api, file, turn);
    uploaded.current.set(key, imageKey);
    return imageKey;
  }

  const suggestTags = useMutation({
    mutationFn: async () => {
      const imageKeys = withPhoto
        ? (
            await Promise.all([
              photo && uploadOnce(photo, rotation),
              boxPhoto && uploadOnce(boxPhoto, 0),
            ])
          ).filter((key): key is string => !!key)
        : savedImageKeys;
      const { title, brand } = getValues();
      return api.suggestTags({
        title: title.trim() || undefined,
        brand: brand.trim() || undefined,
        imageKeys,
      });
    },
    onSuccess: ({ tags }) => {
      const current = getValues('tags');
      const added = tags.filter(
        (tag) => !current.some((have) => have.toLocaleLowerCase() === tag.toLocaleLowerCase()),
      );
      setValue('tags', uniqueTags([...current, ...added]).slice(0, MAX_TAGS), {
        shouldDirty: true,
      });
      toast(added.length ? `Added ${added.join(', ')}` : 'No new tags to suggest');
    },
    onError: (error) => toast.error(error.message),
  });
  /**
   * Fills in the title, brand and piece count printed on the box. Only empty fields are
   * filled, so nothing the user typed is overwritten.
   */
  const readBox = useMutation({
    mutationFn: async () => {
      const imageKey = boxPhoto ? await uploadOnce(boxPhoto, 0) : savedBoxImageKey;
      if (!imageKey) throw new Error('Add a box photo first');
      return api.readBox({ imageKey });
    },
    onSuccess: (details) => {
      const found = BOX_FIELDS.filter(([field]) => details[field] !== undefined);
      if (!found.length) {
        toast("Couldn't read the box. Try a photo of the front, straight on.");
        return;
      }
      const filled = found.filter(([field]) => !getValues(field).trim());
      for (const [field] of filled) {
        setValue(field, String(details[field]), { shouldDirty: true, shouldValidate: true });
      }
      toast(
        filled.length
          ? `Filled in ${listNames(filled.map(([, name]) => name))} from the box`
          : 'Those details are already filled in',
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const canReadBox = !!boxPhoto || !!savedBoxImageKey;

  const canSuggest = !!title?.trim() || !!photo || !!boxPhoto || savedImageKeys.length > 0;

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

  // Built on submit, not during render: it reads the uploads made for tag suggestions.
  const submit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit((values) =>
      onSubmit(values, {
        photo,
        rotation,
        boxPhoto,
        imageKey: photo && uploaded.current.get(uploadKey(photo, rotation)),
        boxImageKey: boxPhoto && uploaded.current.get(uploadKey(boxPhoto, 0)),
      }),
    )(event);

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
      {withPhoto && (
        <PhotoPicker
          label="Box photo (optional)"
          emptyText="Add a photo of the box"
          compact
          photo={boxPhoto}
          error={boxPhotoError}
          onChange={(file) => {
            setBoxPhotoError(undefined);
            if (file && !file.type.startsWith('image/')) {
              setBoxPhotoError('Choose an image file');
              return;
            }
            if (file && file.size > MAX_UPLOAD_BYTES * 4) {
              setBoxPhotoError('That photo is too large');
              return;
            }
            setBoxPhoto(file);
          }}
        />
      )}
      {canReadBox && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={readBox.isPending}
          onClick={() => readBox.mutate()}
        >
          {readBox.isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <ScanTextIcon aria-hidden />
          )}
          {readBox.isPending ? 'Reading the box…' : 'Fill in from box'}
        </Button>
      )}

      {/* The fields sit on a card, so the form reads as one block on the paper background. */}
      <FieldGroup className="rounded-2xl border bg-card p-4 shadow-xs">
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
          {/* Wrapped, so the field's layout doesn't stretch it to full width. */}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canSuggest || suggestTags.isPending}
              onClick={() => suggestTags.mutate()}
            >
              {suggestTags.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <SparklesIcon aria-hidden />
              )}
              Suggest tags
            </Button>
          </div>
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

        {status === 'done' && (
          <fieldset className="space-y-4 rounded-xl border bg-muted/40 p-4">
            <legend className="px-1 text-sm font-medium">How was it?</legend>
            <Field>
              <FieldLabel htmlFor="rating">Rating</FieldLabel>
              <Controller
                control={control}
                name="rating"
                render={({ field }) => (
                  <StarRating id="rating" value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="difficulty">Difficulty</FieldLabel>
              <Controller
                control={control}
                name="difficulty"
                render={({ field }) => (
                  <ToggleGroup
                    id="difficulty"
                    type="single"
                    variant="outline"
                    spacing={0}
                    value={field.value}
                    // Tapping the chosen level again clears it ('').
                    onValueChange={field.onChange}
                    className="w-full"
                  >
                    {DIFFICULTIES.map((level) => (
                      <ToggleGroupItem key={level} value={level} className="flex-1 capitalize">
                        {level}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.missingPieces}>
                <FieldLabel htmlFor="missingPieces">Missing pieces</FieldLabel>
                <Input
                  id="missingPieces"
                  inputMode="numeric"
                  placeholder="0"
                  aria-invalid={!!errors.missingPieces}
                  {...register('missingPieces')}
                />
                <FieldError errors={[errors.missingPieces]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="wouldRedo">Do it again?</FieldLabel>
                <Controller
                  control={control}
                  name="wouldRedo"
                  render={({ field }) => (
                    <ToggleGroup
                      id="wouldRedo"
                      type="single"
                      variant="outline"
                      spacing={0}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="w-full"
                    >
                      <ToggleGroupItem value="yes" className="flex-1">
                        Yes
                      </ToggleGroupItem>
                      <ToggleGroupItem value="no" className="flex-1">
                        No
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                />
              </Field>
            </div>
          </fieldset>
        )}

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

      <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function PhotoPicker({
  label = 'Photo',
  emptyText = 'Take or choose a photo',
  compact = false,
  photo,
  rotation = 0,
  onRotate,
  error,
  onChange,
}: {
  label?: string;
  emptyText?: string;
  /** A smaller drop area, for an optional photo. */
  compact?: boolean;
  photo?: File;
  rotation?: Rotation;
  /** Omit to hide the rotate button. */
  onRotate?: () => void;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  const inputId = useId();

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      {photo ? (
        <div className="relative">
          <PhotoPreview file={photo} rotation={rotation} />
          <div className="absolute top-2 right-2 flex gap-2">
            {onRotate && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-full"
                onClick={onRotate}
                aria-label={`Rotate ${label.toLowerCase()}`}
              >
                <RotateCwIcon />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={() => onChange(undefined)}
              aria-label={`Remove ${label.replace(' (optional)', '').toLowerCase()}`}
            >
              <XIcon />
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card/60 text-muted-foreground transition-colors hover:bg-muted/50 ${
            compact ? 'py-4' : 'aspect-[4/3]'
          }`}
        >
          <ImagePlusIcon className={compact ? 'size-6' : 'size-8'} aria-hidden />
          <span className="text-sm">{emptyText}</span>
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

/** "title", "title and brand", "title, brand and pieces". */
function listNames(names: readonly string[]) {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

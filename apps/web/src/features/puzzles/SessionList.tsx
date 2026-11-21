import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDownIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { sessionMs, type Puzzle, type TimerSession } from '@puzzle-log/shared';
import { useUpdatePuzzle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatDateTime, formatDuration } from './format';

/**
 * The finished sessions, newest first, with ways to fix mistakes: delete one (say, the night
 * the timer ran until morning) and add time that wasn't timed.
 */
export function SessionList({ puzzle }: { puzzle: Puzzle }) {
  const updatePuzzle = useUpdatePuzzle();
  const sessions = puzzle.sessions ?? [];

  function saveSessions(next: TimerSession[], message: string, undo?: TimerSession[]) {
    updatePuzzle.mutate(
      // JSON Merge Patch: null removes the list once it's empty.
      { id: puzzle.id, patch: { sessions: next.length ? next : null } },
      {
        onSuccess: () =>
          toast.success(
            message,
            undo && {
              action: { label: 'Undo', onClick: () => saveSessions(undo, 'Session restored') },
            },
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Collapsible className="space-y-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2">
          <ChevronDownIcon
            aria-hidden
            className="transition-transform group-data-[state=open]:rotate-180"
          />
          {sessions.length === 1 ? '1 session' : `${sessions.length} sessions`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">
        {sessions.length > 0 && (
          <ul className="divide-y rounded-lg border" aria-label="Sessions">
            {sessions
              .map((session, index) => ({ session, index }))
              .reverse()
              .map(({ session, index }) => (
                <li
                  key={`${index}-${session.start}`}
                  className="flex items-center gap-2 py-1 pr-1 pl-3 text-sm"
                >
                  <span className="flex-1">{formatDateTime(session.start)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(sessionMs(session))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete session from ${formatDateTime(session.start)}`}
                    disabled={updatePuzzle.isPending}
                    onClick={() =>
                      saveSessions(
                        sessions.filter((_, i) => i !== index),
                        'Session deleted',
                        sessions,
                      )
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </li>
              ))}
          </ul>
        )}
        <AddTimeForm
          disabled={updatePuzzle.isPending}
          onAdd={(session) => saveSessions([...sessions, session], 'Time added')}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

const addTimeSchema = z
  .object({
    hours: z.string().regex(/^\d{0,2}$/, 'Whole hours'),
    minutes: z.string().regex(/^\d{0,2}$/, 'Whole minutes'),
  })
  .refine(({ hours, minutes }) => Number(hours) * 60 + Number(minutes) > 0, {
    message: 'Enter some time',
    path: ['minutes'],
  });

type AddTimeValues = z.infer<typeof addTimeSchema>;

/** Time worked without the timer, saved as a session that ends now. */
function AddTimeForm({
  onAdd,
  disabled,
}: {
  onAdd: (session: TimerSession) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddTimeValues>({
    resolver: zodResolver(addTimeSchema),
    defaultValues: { hours: '', minutes: '' },
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        Add time
      </Button>
    );
  }

  return (
    <form
      noValidate
      aria-label="Add time"
      className="space-y-3"
      onSubmit={handleSubmit(({ hours, minutes }) => {
        const end = new Date();
        const start = new Date(end.getTime() - (Number(hours) * 60 + Number(minutes)) * 60_000);
        onAdd({ start: start.toISOString(), end: end.toISOString() });
        reset();
        setOpen(false);
      })}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.hours}>
          <FieldLabel htmlFor="add-hours">Hours</FieldLabel>
          <Input id="add-hours" inputMode="numeric" placeholder="0" {...register('hours')} />
          <FieldError errors={[errors.hours]} />
        </Field>
        <Field data-invalid={!!errors.minutes}>
          <FieldLabel htmlFor="add-minutes">Minutes</FieldLabel>
          <Input id="add-minutes" inputMode="numeric" placeholder="30" {...register('minutes')} />
          <FieldError errors={[errors.minutes]} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={disabled}>
          Save time
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

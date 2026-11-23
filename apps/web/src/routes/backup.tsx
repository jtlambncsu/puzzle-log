import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { DownloadIcon, FileSpreadsheetIcon, ImagesIcon, Loader2Icon } from 'lucide-react';
import { puzzlesQueryOptions, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { saveFile } from '@/features/backup/saveFile';
import { zipPhotos } from '@/features/backup/zipPhotos';
import { photoParts, PHOTOS_PER_ZIP, puzzlesToCsv } from '@/lib/export';
import { today } from '@/lib/date';

export const Route = createFileRoute('/backup')({
  // Fresh from the server, so the backup includes changes made on other devices.
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData({ ...puzzlesQueryOptions(api), revalidateIfStale: true }),
  component: BackupPage,
});

type PartState =
  | { name: 'idle' }
  | { name: 'preparing'; done: number }
  | { name: 'ready'; blob: Blob; failed: number }
  | { name: 'error' };

/** A copy of your log you keep yourself: a spreadsheet, plus the photos in zip parts. */
function BackupPage() {
  const api = useApi();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const parts = photoParts(puzzles);
  const [partStates, setPartStates] = useState<Record<number, PartState>>({});

  function setPart(index: number, state: PartState) {
    setPartStates((states) => ({ ...states, [index]: state }));
  }

  async function prepare(index: number) {
    setPart(index, { name: 'preparing', done: 0 });
    try {
      const { blob, failed } = await zipPhotos(parts[index]!, () =>
        setPartStates((states) => {
          const state = states[index];
          return state?.name === 'preparing'
            ? { ...states, [index]: { ...state, done: state.done + 1 } }
            : states;
        }),
      );
      setPart(index, { name: 'ready', blob, failed });
    } catch {
      setPart(index, { name: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold">Backup</h1>
        <p className="text-sm text-muted-foreground">
          A copy of your log to keep yourself. On a phone, choose “Save to Files” when the share
          sheet opens.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border p-4" aria-labelledby="sheet-heading">
        <h2 id="sheet-heading" className="flex items-center gap-2 font-medium">
          <FileSpreadsheetIcon className="size-4" aria-hidden />
          Spreadsheet
        </h2>
        <p className="text-sm text-muted-foreground">
          {puzzles.length === 1 ? 'Your puzzle' : `All ${puzzles.length} puzzles`}, one per row, for
          Excel, Numbers or Google Sheets.
        </p>
        <Button
          onClick={() =>
            void saveFile(
              new Blob([puzzlesToCsv(puzzles)], { type: 'text/csv' }),
              `puzzle-log-${today()}.csv`,
            )
          }
        >
          <DownloadIcon aria-hidden />
          Download spreadsheet
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border p-4" aria-labelledby="photos-heading">
        <h2 id="photos-heading" className="flex items-center gap-2 font-medium">
          <ImagesIcon className="size-4" aria-hidden />
          Photos
        </h2>
        <p className="text-sm text-muted-foreground">
          In parts, so your phone doesn't run out of memory. Each photo is named as in the
          spreadsheet's Photo column.
        </p>
        {parts.length === 0 && <p className="text-sm">No photos yet.</p>}
        <ul className="space-y-2">
          {parts.map((part, index) => {
            const first = index * PHOTOS_PER_ZIP + 1;
            const label = `Photos ${first}–${first + part.length - 1}`;
            const state = partStates[index] ?? { name: 'idle' };
            const fileName = `puzzle-photos-${index + 1}-of-${parts.length}.zip`;
            return (
              <li key={index} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{label}</span>
                {state.name === 'idle' || state.name === 'error' ? (
                  <Button variant="outline" size="sm" onClick={() => void prepare(index)}>
                    {state.name === 'error' ? 'Try again' : 'Prepare'}
                  </Button>
                ) : state.name === 'preparing' ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    {state.done} of {part.length}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {state.failed > 0 && (
                      <span className="text-xs text-muted-foreground">{state.failed} missing</span>
                    )}
                    {/* A second tap, because sharing has to follow a tap straight away. */}
                    <Button size="sm" onClick={() => void saveFile(state.blob, fileName)}>
                      <DownloadIcon aria-hidden />
                      Save
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ImagePlusIcon, ScanSearchIcon, SplitIcon, UploadIcon } from 'lucide-react';
import { IMPORTED_TITLE, type Puzzle } from '@puzzle-log/shared';
import { puzzleKeys, puzzlesQueryOptions, savePuzzle, useApi } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { fingerprintSavedPhotos, needingFingerprints } from '@/features/import/fingerprintSaved';
import {
  clearImportInProgress,
  markImportInProgress,
  takeInterruptedImport,
} from '@/features/import/interrupted';
import { PhotoPreview } from '@/features/puzzles/PhotoPreview';
import { mapWithConcurrency } from '@/lib/mapWithConcurrency';
import {
  analyzePhoto,
  existingFrom,
  fingerprintToHex,
  groupPhotos,
  makeGroup,
  type AnalyzedPhoto,
  type GroupingResult,
  type LooksImported,
  type PhotoGroup,
} from '@/lib/photoImport';

export const Route = createFileRoute('/puzzles/import')({
  // The saved puzzles' hashes and fingerprints tell us what's already imported, so refresh
  // them even if a cached list exists (e.g. after importing on another device).
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureQueryData({ ...puzzlesQueryOptions(api), revalidateIfStale: true }),
  component: ImportPage,
});

type Stage =
  | { name: 'pick' }
  | { name: 'analyzing'; done: number; total: number; checked: number; toCheck: number }
  | { name: 'ready'; picked: number; result: GroupingResult }
  | { name: 'importing'; done: number; failed: number; total: number }
  | { name: 'finished'; imported: number; failed: number };

/**
 * Import a whole album of old photos: find duplicates in the browser, then upload one photo
 * per puzzle. Each puzzle is saved as done, dated from its photo, and marked for review,
 * where AI suggests its title and tags (see `/review`).
 */
function ImportPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: puzzles } = useSuspenseQuery(puzzlesQueryOptions(api));
  const [stage, setStage] = useState<Stage>({ name: 'pick' });
  // Read once, on the first render after a reload that cut an import short.
  const [interrupted] = useState(takeInterruptedImport);
  const importedSoFar = puzzles.filter((puzzle) => puzzle.importHashes?.length).length;
  const toReview = puzzles.filter((puzzle) => puzzle.needsReview).length;

  async function analyze(files: File[]) {
    if (!files.length) return;
    markImportInProgress({ step: 'checking', photos: files.length });
    const toCheck = needingFingerprints(puzzles);
    setStage({
      name: 'analyzing',
      done: 0,
      total: files.length,
      checked: 0,
      toCheck: toCheck.length,
    });
    const progress = (key: 'done' | 'checked') =>
      setStage((s) => (s.name === 'analyzing' ? { ...s, [key]: s[key] + 1 } : s));
    const analyzed: AnalyzedPhoto[] = [];
    await Promise.all([
      // Saved puzzles without a fingerprint get one, so they can be recognized below.
      fingerprintSavedPhotos(api, queryClient, toCheck, () => progress('checked')),
      // One at a time: decoding full-size photos is memory-hungry on a phone.
      mapWithConcurrency(files, 1, async (file) => {
        analyzed.push(await analyzePhoto(file));
        progress('done');
      }),
    ]);
    // The cached list now includes the fingerprints just saved.
    const saved = queryClient.getQueryData<Puzzle[]>(puzzleKeys.list()) ?? puzzles;
    clearImportInProgress();
    setStage({
      name: 'ready',
      picked: files.length,
      result: groupPhotos(analyzed, existingFrom(saved)),
    });
  }

  async function importGroups(groups: PhotoGroup[]) {
    setStage({ name: 'importing', done: 0, failed: 0, total: groups.length });
    markImportInProgress({ step: 'uploading', photos: groups.length });
    let imported = 0;
    let failed = 0;
    // Two at a time: each upload decodes and shrinks a full-size photo first.
    await mapWithConcurrency(groups, 2, async (group) => {
      try {
        await savePuzzle(api, {
          input: {
            title: IMPORTED_TITLE,
            status: 'done',
            completedAt: group.date,
            needsReview: true,
            // Every photo in the group, so none of them is imported again next time.
            importHashes: group.photos.map((photo) => photo.hash).slice(0, 50),
            photoFingerprint:
              group.best.fingerprints && fingerprintToHex(group.best.fingerprints[0]!),
          },
          photo: group.best.file,
        });
        imported++;
      } catch {
        failed++;
      }
      setStage((s) => (s.name === 'importing' ? { ...s, done: imported, failed } : s));
    });
    clearImportInProgress();
    await queryClient.invalidateQueries({ queryKey: puzzleKeys.list() });
    setStage({ name: 'finished', imported, failed });
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Import photos</h1>

      {stage.name === 'pick' && (
        <>
          {interrupted && (
            <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm">
              <p className="font-medium">
                The last import stopped while{' '}
                {interrupted.step === 'checking'
                  ? `checking ${interrupted.photos} photos`
                  : `uploading ${interrupted.photos} puzzles`}
                .
              </p>
              <p className="text-muted-foreground">
                The phone probably ran out of memory and reloaded the page. Try about 150 photos at
                a time.{interrupted.step === 'uploading' && ' Puzzles already uploaded are kept.'}
              </p>
            </div>
          )}
          {importedSoFar > 0 && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm">
              So far: {importedSoFar} imported, {toReview} waiting for review.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Pick up to about 150 photos at a time; iPhones can run out of memory with more. Batches
            can overlap: duplicates are found on this phone before anything is uploaded, and photos
            already in your log are skipped. In the photo picker, drag across photos to select many
            at once.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-muted-foreground transition-colors hover:bg-muted/50">
            <ImagePlusIcon className="size-8" aria-hidden />
            <span>Choose photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => void analyze([...(event.target.files ?? [])])}
            />
          </label>
        </>
      )}

      {stage.name === 'analyzing' && (
        <div className="space-y-4">
          <ProgressBlock
            icon={<ScanSearchIcon aria-hidden />}
            label={`Received ${stage.total} photos. Looking for duplicates: ${stage.done} of ${stage.total}`}
            value={stage.done / stage.total}
          />
          {stage.toCheck > 0 && (
            <ProgressBlock
              icon={<ScanSearchIcon aria-hidden />}
              label={`Checking your saved puzzles (once): ${stage.checked} of ${stage.toCheck}`}
              value={stage.checked / stage.toCheck}
            />
          )}
        </div>
      )}

      {stage.name === 'ready' && (
        <ReadyToImport
          picked={stage.picked}
          result={stage.result}
          onChange={(result) => setStage({ ...stage, result })}
          onImport={() => void importGroups(stage.result.groups)}
          onCancel={() => setStage({ name: 'pick' })}
        />
      )}

      {stage.name === 'importing' && (
        <ProgressBlock
          icon={<UploadIcon aria-hidden />}
          label={`Uploading: ${stage.done} of ${stage.total} puzzles${
            stage.failed ? `, ${stage.failed} failed` : ''
          }. Keep this page open.`}
          value={(stage.done + stage.failed) / stage.total}
        />
      )}

      {stage.name === 'finished' && (
        <div className="space-y-3">
          <p>
            Imported {stage.imported} {stage.imported === 1 ? 'puzzle' : 'puzzles'}.
            {stage.failed > 0 &&
              ` ${stage.failed} didn't upload; pick the same photos again to retry them (the rest are skipped).`}
          </p>
          <p className="text-sm text-muted-foreground">
            Next, go through them one by one: AI suggests a title and tags for each, and you fix
            anything it got wrong.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/review">Start reviewing</Link>
            </Button>
            <Button variant="outline" onClick={() => setStage({ name: 'pick' })}>
              Import more
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        {icon}
        {label}
      </p>
      <Progress value={Math.round(value * 100)} aria-label="Progress" />
    </div>
  );
}

/**
 * The summary before uploading, plus every group of photos taken to be the same puzzle, so
 * a wrong guess can be split before it's imported.
 */
function ReadyToImport({
  picked,
  result,
  onChange,
  onImport,
  onCancel,
}: {
  picked: number;
  result: GroupingResult;
  onChange: (result: GroupingResult) => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const { groups, exactCopies, alreadyImported, looksImported } = result;
  const merged = groups.filter((group) => group.photos.length > 1);
  const reshoots = merged.reduce((sum, group) => sum + group.photos.length - 1, 0);

  function importAnyway(match: LooksImported) {
    onChange({
      ...result,
      looksImported: looksImported.filter((m) => m !== match),
      groups: [...groups, makeGroup([match.photo])],
    });
  }

  function split(group: PhotoGroup) {
    const singles = group.photos.map((photo) => makeGroup([photo]));
    onChange({ ...result, groups: groups.flatMap((g) => (g === group ? singles : [g])) });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">
          {picked} photos → {groups.length} {groups.length === 1 ? 'puzzle' : 'puzzles'}
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {reshoots > 0 && <li>{reshoots} extra shots of the same puzzle</li>}
          {exactCopies > 0 && <li>{exactCopies} exact copies</li>}
          {alreadyImported > 0 && <li>{alreadyImported} imported before</li>}
          {looksImported.length > 0 && (
            <li>{looksImported.length} that look like puzzles already in your log</li>
          )}
        </ul>
      </div>

      {merged.length > 0 && (
        <section className="space-y-2" aria-labelledby="merged-heading">
          <h2 id="merged-heading" className="font-medium">
            Same puzzle? ({merged.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Each row becomes one puzzle, using the outlined photo. If a row mixes different puzzles,
            split it.
          </p>
          <ul className="space-y-2">
            {merged.map((group) => (
              <li key={group.best.hash} className="flex items-center gap-2 rounded-lg border p-2">
                <div className="flex flex-1 gap-1.5 overflow-x-auto">
                  {group.photos.map((photo) => (
                    <PhotoPreview
                      key={photo.hash}
                      file={photo.thumbnail ?? photo.file}
                      alt=""
                      className={`aspect-square size-16 shrink-0 rounded-md ${
                        photo === group.best ? 'ring-2 ring-primary' : ''
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => split(group)}
                  aria-label={`Split these ${group.photos.length} photos into separate puzzles`}
                >
                  <SplitIcon aria-hidden />
                  Split
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {looksImported.length > 0 && (
        <section className="space-y-2" aria-labelledby="existing-heading">
          <h2 id="existing-heading" className="font-medium">
            Already in your log? ({looksImported.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            These look like a puzzle you've saved, so they're skipped. If one is really a different
            puzzle, import it anyway.
          </p>
          <ul className="space-y-2">
            {looksImported.map((match) => (
              <li key={match.photo.hash} className="flex items-center gap-2 rounded-lg border p-2">
                <PhotoPreview
                  file={match.photo.thumbnail ?? match.photo.file}
                  alt=""
                  className="aspect-square size-16 shrink-0 rounded-md"
                />
                {match.puzzle.imageUrl && (
                  <img
                    src={match.puzzle.imageUrl}
                    alt=""
                    crossOrigin="anonymous"
                    className="aspect-square size-16 shrink-0 rounded-md object-cover"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{match.puzzle.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => importAnyway(match)}
                  aria-label={`Import anyway: not the same as “${match.puzzle.title}”`}
                >
                  Import anyway
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onImport} disabled={groups.length === 0}>
          <UploadIcon aria-hidden />
          Import {groups.length} {groups.length === 1 ? 'puzzle' : 'puzzles'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Start over
        </Button>
      </div>
    </div>
  );
}

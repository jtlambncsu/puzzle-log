import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  normalizeBarcode,
  type BarcodeLookupResult,
  type CreatePuzzleInput,
  type ProductInfo,
  type Puzzle,
  type StartTimerInput,
  type UpdatePuzzleInput,
} from '@puzzle-log/shared';

/**
 * A tiny in-memory fake of our API. Tests talk to it through real `fetch` calls, which MSW
 * intercepts, so the API client, TanStack Query and the router all run for real.
 */
export const db = {
  puzzles: new Map<string, Puzzle>(),
  uploads: [] as FormData[],
  patches: [] as UpdatePuzzleInput[],
  /** What the fake barcode lookup knows, keyed by normalized barcode. */
  products: new Map<string, ProductInfo>(),
  barcodeLookups: [] as string[],
  reset() {
    this.products.clear();
    this.barcodeLookups = [];
    this.puzzles.clear();
    this.uploads = [];
    this.patches = [];
  },
  add(puzzle: Partial<Puzzle> & { title: string }) {
    const full: Puzzle = {
      id: crypto.randomUUID(),
      userId: 'test-user',
      createdAt: new Date().toISOString(),
      ...puzzle,
    };
    this.puzzles.set(full.id, full);
    return full;
  },
};

function stopTimer({ timerStartedAt, ...puzzle }: Puzzle): Puzzle {
  if (!timerStartedAt) return puzzle;
  const session = { start: timerStartedAt, end: new Date().toISOString() };
  return { ...puzzle, sessions: [...(puzzle.sessions ?? []), session] };
}

export const S3_URL = 'https://photos.s3.example/';

// Relative URLs ('/api/...') resolve against jsdom's location.
export const handlers = [
  http.get('/api/puzzles', () => HttpResponse.json([...db.puzzles.values()].reverse())),

  http.get('/api/puzzles/:id', ({ params }) => {
    const puzzle = db.puzzles.get(params.id as string);
    return puzzle ? HttpResponse.json(puzzle) : HttpResponse.json({}, { status: 404 });
  }),

  http.post('/api/puzzles', async ({ request }) => {
    const input = (await request.json()) as CreatePuzzleInput;
    const puzzle = db.add({
      ...input,
      ...(input.barcode && { barcode: normalizeBarcode(input.barcode) }),
      ...(input.imageKey && { imageUrl: `${S3_URL}${input.imageKey}?signed` }),
    });
    return HttpResponse.json(puzzle, { status: 201 });
  }),

  http.patch('/api/puzzles/:id', async ({ params, request }) => {
    const existing = db.puzzles.get(params.id as string);
    if (!existing) return HttpResponse.json({}, { status: 404 });
    const patch = (await request.json()) as UpdatePuzzleInput;
    db.patches.push(patch);
    let updated: Puzzle = { ...existing };
    for (const [name, value] of Object.entries(patch)) {
      // JSON Merge Patch, like the real API: null removes the field.
      if (value === null) delete updated[name as keyof Puzzle];
      else Object.assign(updated, { [name]: value });
    }
    // Like the real API, moving a puzzle out of in progress stops its timer.
    if (patch.status && patch.status !== 'in_progress') updated = stopTimer(updated);
    if (patch.imageKey) updated.imageUrl = `${S3_URL}${patch.imageKey}?signed`;
    db.puzzles.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  // The timer, following the real API's rules: starting moves the puzzle to in progress.
  http.post('/api/puzzles/:id/timer/start', async ({ params, request }) => {
    const existing = db.puzzles.get(params.id as string);
    if (!existing) return HttpResponse.json({}, { status: 404 });
    const { today } = (await request.json()) as StartTimerInput;
    const updated: Puzzle = {
      ...existing,
      status: 'in_progress',
      startedAt: existing.startedAt ?? today,
      timerStartedAt: existing.timerStartedAt ?? new Date().toISOString(),
    };
    db.puzzles.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  http.post('/api/puzzles/:id/timer/stop', ({ params }) => {
    const existing = db.puzzles.get(params.id as string);
    if (!existing) return HttpResponse.json({}, { status: 404 });
    const updated = stopTimer(existing);
    db.puzzles.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  // Downloading a stored photo (to rotate it).
  http.get(`${S3_URL}*`, () =>
    HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xd8, 0xff]).buffer, {
      headers: { 'Content-Type': 'image/jpeg' },
    }),
  ),

  http.delete('/api/puzzles/:id', ({ params }) =>
    db.puzzles.delete(params.id as string)
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json({}, { status: 404 }),
  ),

  http.get('/api/barcodes/:code', ({ params }) => {
    const barcode = normalizeBarcode(params.code as string);
    if (!barcode) return HttpResponse.json({}, { status: 400 });
    db.barcodeLookups.push(barcode);
    return HttpResponse.json({
      barcode,
      product: db.products.get(barcode),
    } satisfies BarcodeLookupResult);
  }),

  http.post('/api/uploads', async ({ request }) => {
    const { contentType } = (await request.json()) as { contentType: string };
    return HttpResponse.json(
      {
        key: 'uploads/test-user/photo-1',
        url: S3_URL,
        fields: { key: 'uploads/test-user/photo-1', 'Content-Type': contentType },
      },
      { status: 201 },
    );
  }),

  http.post(S3_URL, async ({ request }) => {
    db.uploads.push(await request.formData());
    return new HttpResponse(null, { status: 204 });
  }),
];

export const server = setupServer(...handlers);

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { CreatePuzzleInput, Puzzle, UpdatePuzzleInput } from '@puzzle-log/shared';

/**
 * A tiny in-memory fake of our API. Tests talk to it through real `fetch` calls, which MSW
 * intercepts, so the API client, TanStack Query and the router all run for real.
 */
export const db = {
  puzzles: new Map<string, Puzzle>(),
  uploads: [] as FormData[],
  patches: [] as UpdatePuzzleInput[],
  reset() {
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
      ...(input.imageKey && { imageUrl: `${S3_URL}${input.imageKey}?signed` }),
    });
    return HttpResponse.json(puzzle, { status: 201 });
  }),

  http.patch('/api/puzzles/:id', async ({ params, request }) => {
    const existing = db.puzzles.get(params.id as string);
    if (!existing) return HttpResponse.json({}, { status: 404 });
    const patch = (await request.json()) as UpdatePuzzleInput;
    db.patches.push(patch);
    const updated: Puzzle = { ...existing };
    for (const [name, value] of Object.entries(patch)) {
      // JSON Merge Patch, like the real API: null removes the field.
      if (value === null) delete updated[name as keyof Puzzle];
      else Object.assign(updated, { [name]: value });
    }
    if (patch.imageKey) updated.imageUrl = `${S3_URL}${patch.imageKey}?signed`;
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

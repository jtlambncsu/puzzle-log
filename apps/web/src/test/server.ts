import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';

/**
 * A tiny in-memory fake of our API. Tests talk to it through real `fetch` calls, which MSW
 * intercepts, so the API client, TanStack Query and the router all run for real.
 */
export const db = {
  puzzles: new Map<string, Puzzle>(),
  uploads: [] as FormData[],
  reset() {
    this.puzzles.clear();
    this.uploads = [];
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

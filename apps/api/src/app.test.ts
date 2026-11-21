import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type AppDeps } from './app.js';
import type { ResolveUser } from './auth.js';
import type { PhotoStorage } from './photos/types.js';

/** Tests pick the caller with a header; no header means not signed in. */
const userFromTestHeader: ResolveUser = (req) => req.header('x-test-user');

function testApp(deps: Partial<AppDeps> = {}) {
  return createApp({ resolveUser: userFromTestHeader, ...deps });
}

const alice = { 'x-test-user': 'alice' };
const bob = { 'x-test-user': 'bob' };

function fakePhotos(): PhotoStorage & { delete: ReturnType<typeof vi.fn> } {
  return {
    createUpload: async (userId) => ({
      key: `uploads/${userId}/abc`,
      url: 'https://bucket.example',
      fields: {},
    }),
    getViewUrl: async (key) => `https://bucket.example/${key}?signed`,
    delete: vi.fn(async () => {}),
  };
}

describe('API', () => {
  it('reports health without signing in', async () => {
    const res = await request(testApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers CORS preflights without sign-in', async () => {
    const res = await request(testApp())
      .options('/api/puzzles')
      .set('Origin', 'https://puzzles.example')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    expect(res.status).toBe(204);
  });

  it('requires sign-in for puzzles and uploads', async () => {
    const app = testApp();
    expect((await request(app).get('/api/puzzles')).status).toBe(401);
    expect((await request(app).post('/api/puzzles').send({ title: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/uploads').send({})).status).toBe(401);
  });

  it('creates and lists puzzles for the signed-in user', async () => {
    const app = testApp();

    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Starry Night', pieceCount: 1000 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Starry Night',
      pieceCount: 1000,
      userId: 'alice',
    });

    const list = await request(app).get('/api/puzzles').set(alice);
    expect(list.body).toHaveLength(1);
  });

  it("keeps each user's puzzles private", async () => {
    const app = testApp();
    const { body: puzzle } = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Mine' });

    expect((await request(app).get('/api/puzzles').set(bob)).body).toEqual([]);
    expect((await request(app).get(`/api/puzzles/${puzzle.id}`).set(bob)).status).toBe(404);
    expect((await request(app).delete(`/api/puzzles/${puzzle.id}`).set(bob)).status).toBe(404);
    expect((await request(app).get(`/api/puzzles/${puzzle.id}`).set(alice)).status).toBe(200);
  });

  it('rejects an invalid puzzle', async () => {
    const res = await request(testApp()).post('/api/puzzles').set(alice).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing puzzle', async () => {
    const res = await request(testApp()).get('/api/puzzles/nope').set(alice);
    expect(res.status).toBe(404);
  });
});

describe('photo uploads', () => {
  const photos = fakePhotos();

  it('returns 501 when uploads are not configured', async () => {
    const res = await request(testApp())
      .post('/api/uploads')
      .set(alice)
      .send({ contentType: 'image/jpeg' });
    expect(res.status).toBe(501);
  });

  it('only issues uploads for images', async () => {
    const res = await request(testApp({ photos }))
      .post('/api/uploads')
      .set(alice)
      .send({ contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });

  it("issues an upload in the user's folder and returns a viewing URL", async () => {
    const app = testApp({ photos });

    const upload = await request(app)
      .post('/api/uploads')
      .set(alice)
      .send({ contentType: 'image/jpeg' });
    expect(upload.status).toBe(201);
    expect(upload.body.key).toBe('uploads/alice/abc');

    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'With photo', imageKey: upload.body.key });
    expect(created.body.imageUrl).toBe('https://bucket.example/uploads/alice/abc?signed');
  });

  it("rejects another user's photo", async () => {
    const res = await request(testApp({ photos }))
      .post('/api/puzzles')
      .set(bob)
      .send({ title: 'Sneaky', imageKey: 'uploads/alice/abc' });
    expect(res.status).toBe(400);
  });

  it('rejects image keys outside the uploads folder', async () => {
    const res = await request(testApp({ photos }))
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Sneaky', imageKey: '../secrets' });
    expect(res.status).toBe(400);
  });
});

describe('updating puzzles', () => {
  async function createPuzzle(app: ReturnType<typeof testApp>, body: object) {
    return (await request(app).post('/api/puzzles').set(alice).send(body)).body;
  }

  it('changes only the given fields', async () => {
    const app = testApp();
    const puzzle = await createPuzzle(app, { title: 'Starry Night', pieceCount: 1000 });

    const res = await request(app)
      .patch(`/api/puzzles/${puzzle.id}`)
      .set(alice)
      .send({ title: 'The Starry Night' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'The Starry Night', pieceCount: 1000 });
  });

  it('removes fields set to null and stores tags without duplicates', async () => {
    const app = testApp();
    const puzzle = await createPuzzle(app, { title: 'Hoth', brand: 'Ravensburger' });

    const res = await request(app)
      .patch(`/api/puzzles/${puzzle.id}`)
      .set(alice)
      .send({ brand: null, tags: ['Star Wars', ' star wars ', 'Snow'] });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('brand');
    expect(res.body.tags).toEqual(['Star Wars', 'Snow']);
  });

  it("won't remove the title", async () => {
    const app = testApp();
    const puzzle = await createPuzzle(app, { title: 'Keep me' });
    const res = await request(app)
      .patch(`/api/puzzles/${puzzle.id}`)
      .set(alice)
      .send({ title: null });
    expect(res.status).toBe(400);
  });

  it("can't update another user's puzzle", async () => {
    const app = testApp();
    const puzzle = await createPuzzle(app, { title: 'Mine' });

    const res = await request(app).patch(`/api/puzzles/${puzzle.id}`).set(bob).send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('rejects empty or invalid updates', async () => {
    const app = testApp();
    const puzzle = await createPuzzle(app, { title: 'Mine' });

    expect((await request(app).patch(`/api/puzzles/${puzzle.id}`).set(alice).send({})).status).toBe(
      400,
    );
    expect(
      (await request(app).patch(`/api/puzzles/${puzzle.id}`).set(alice).send({ title: '' })).status,
    ).toBe(400);
  });

  it('deletes the old photo when the photo is replaced', async () => {
    const photos = fakePhotos();
    const app = testApp({ photos });
    const puzzle = await createPuzzle(app, { title: 'Rotated', imageKey: 'uploads/alice/old' });

    const res = await request(app)
      .patch(`/api/puzzles/${puzzle.id}`)
      .set(alice)
      .send({ imageKey: 'uploads/alice/new' });

    expect(res.body.imageUrl).toBe('https://bucket.example/uploads/alice/new?signed');
    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/old');
  });

  it("rejects another user's photo key", async () => {
    const app = testApp({ photos: fakePhotos() });
    const puzzle = await createPuzzle(app, { title: 'Mine' });

    const res = await request(app)
      .patch(`/api/puzzles/${puzzle.id}`)
      .set(alice)
      .send({ imageKey: 'uploads/bob/theirs' });
    expect(res.status).toBe(400);
  });

  it("deletes a puzzle's photo along with it", async () => {
    const photos = fakePhotos();
    const app = testApp({ photos });
    const puzzle = await createPuzzle(app, { title: 'Gone', imageKey: 'uploads/alice/photo' });

    expect((await request(app).delete(`/api/puzzles/${puzzle.id}`).set(alice)).status).toBe(204);
    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/photo');
  });

  it('still succeeds if deleting the old photo fails', async () => {
    const photos = fakePhotos();
    photos.delete.mockRejectedValue(new Error('S3 is down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = testApp({ photos });
    const puzzle = await createPuzzle(app, { title: 'x', imageKey: 'uploads/alice/photo' });

    expect((await request(app).delete(`/api/puzzles/${puzzle.id}`).set(alice)).status).toBe(204);
  });
});

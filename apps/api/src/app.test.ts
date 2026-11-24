import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type AppDeps } from './app.js';
import type { ResolveUser } from './auth.js';
import type { PhotoStorage } from './photos/types.js';
import { SuggestionUnavailableError, type PuzzleSuggester } from './suggestions/types.js';

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

  it('stores a status and rejects unknown ones', async () => {
    const app = testApp();
    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Someday', status: 'wishlist' });
    expect(created.body.status).toBe('wishlist');

    const bad = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', status: 'lost' });
    expect(bad.status).toBe(400);
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

describe('puzzle timer', () => {
  /** A clock the test moves forward by hand. */
  function timerApp() {
    let now = new Date('2026-11-21T18:00:00.000Z');
    const app = testApp({ clock: () => now });
    return {
      app,
      advance: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)),
    };
  }

  async function createOwned(app: ReturnType<typeof testApp>) {
    const res = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Big Ben', status: 'owned' });
    return res.body.id as string;
  }

  it('starts: records the start, moves the puzzle to in progress, and sets the start date', async () => {
    const { app } = timerApp();
    const id = await createOwned(app);

    const res = await request(app)
      .post(`/api/puzzles/${id}/timer/start`)
      .set(alice)
      .send({ today: '2026-11-21' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-11-21',
      timerStartedAt: '2026-11-21T18:00:00.000Z',
    });
  });

  it('stops: saves the session, and pressing either button twice is harmless', async () => {
    const { app, advance } = timerApp();
    const id = await createOwned(app);
    const start = () =>
      request(app).post(`/api/puzzles/${id}/timer/start`).set(alice).send({ today: '2026-11-21' });
    const stop = () => request(app).post(`/api/puzzles/${id}/timer/stop`).set(alice);

    await start();
    advance(30);
    await start(); // already running: keeps the original start
    advance(15);
    const stopped = await stop();
    advance(5);
    const again = await stop();

    expect(stopped.body.timerStartedAt).toBeUndefined();
    expect(stopped.body.sessions).toEqual([
      { start: '2026-11-21T18:00:00.000Z', end: '2026-11-21T18:45:00.000Z' },
    ]);
    expect(again.body.sessions).toHaveLength(1);
  });

  it('keeps the first start date when the timer is started again', async () => {
    const { app, advance } = timerApp();
    const id = await createOwned(app);
    await request(app)
      .post(`/api/puzzles/${id}/timer/start`)
      .set(alice)
      .send({ today: '2026-11-21' });
    advance(60);
    await request(app).post(`/api/puzzles/${id}/timer/stop`).set(alice);
    advance(60 * 24);

    const res = await request(app)
      .post(`/api/puzzles/${id}/timer/start`)
      .set(alice)
      .send({ today: '2026-11-22' });

    expect(res.body.startedAt).toBe('2026-11-21');
  });

  it('stops the timer when the puzzle is marked done', async () => {
    const { app, advance } = timerApp();
    const id = await createOwned(app);
    await request(app)
      .post(`/api/puzzles/${id}/timer/start`)
      .set(alice)
      .send({ today: '2026-11-21' });
    advance(90);

    const res = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ status: 'done', completedAt: '2026-11-21' });

    expect(res.body).toMatchObject({
      status: 'done',
      sessions: [{ end: '2026-11-21T19:30:00.000Z' }],
    });
    expect(res.body.timerStartedAt).toBeUndefined();
  });

  it("can't be set directly, needs a valid date, and is private to its owner", async () => {
    const { app } = timerApp();
    const id = await createOwned(app);

    const patched = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ notes: 'hi', timerStartedAt: '2026-01-01T00:00:00.000Z' });
    expect(patched.body.timerStartedAt).toBeUndefined();

    expect(
      (await request(app).post(`/api/puzzles/${id}/timer/start`).set(alice).send({})).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/puzzles/${id}/timer/start`)
          .set(bob)
          .send({ today: '2026-11-21' })
      ).status,
    ).toBe(404);
    expect((await request(app).post(`/api/puzzles/${id}/timer/stop`).set(bob)).status).toBe(404);
  });

  it('lets sessions be corrected, but only with valid times', async () => {
    const { app } = timerApp();
    const id = await createOwned(app);
    const sessions = [{ start: '2026-11-20T10:00:00Z', end: '2026-11-20T11:00:00Z' }];

    const ok = await request(app).patch(`/api/puzzles/${id}`).set(alice).send({ sessions });
    const backwards = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ sessions: [{ start: sessions[0]!.end, end: sessions[0]!.start }] });

    expect(ok.body.sessions).toEqual(sessions);
    expect(backwards.status).toBe(400);
  });
});

describe('AI suggestions for imported puzzles', () => {
  function suggestApp(suggest: PuzzleSuggester['suggest']) {
    const suggester = {
      suggest: vi.fn(suggest),
      suggestTags: vi.fn(async () => []),
      readBox: vi.fn(),
    };
    return { app: testApp({ photos: fakePhotos(), suggester }), suggester };
  }

  async function importPuzzle(app: ReturnType<typeof testApp>, extra = {}) {
    const res = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({
        title: 'Imported puzzle',
        needsReview: true,
        imageKey: 'uploads/alice/abc',
        ...extra,
      });
    return res.body.id as string;
  }

  it("names an imported puzzle from its photo, reusing the user's tags", async () => {
    const { app, suggester } = suggestApp(async () => ({
      title: 'Hogwarts at Night',
      brand: 'Ravensburger',
      tags: ['Harry Potter', 'Castles'],
    }));
    await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Old', tags: ['Harry Potter'] });
    const id = await importPuzzle(app, { tags: ['Imported'] });

    const res = await request(app).post(`/api/puzzles/${id}/suggest`).set(alice);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Hogwarts at Night',
      brand: 'Ravensburger',
      tags: ['Imported', 'Harry Potter', 'Castles'],
      needsReview: true,
    });
    expect(suggester.suggest).toHaveBeenCalledWith(
      'https://bucket.example/uploads/alice/abc?signed',
      ['Harry Potter'],
    );
  });

  it('never overwrites a reviewed puzzle', async () => {
    const { app, suggester } = suggestApp(async () => ({ title: 'x', tags: [] }));
    const res = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Mine', imageKey: 'uploads/alice/abc' });

    expect((await request(app).post(`/api/puzzles/${res.body.id}/suggest`).set(alice)).status).toBe(
      409,
    );
    expect(suggester.suggest).not.toHaveBeenCalled();
  });

  it("reports when suggestions are unavailable, off, or for someone else's puzzle", async () => {
    const { app } = suggestApp(async () => {
      throw new SuggestionUnavailableError('down');
    });
    const id = await importPuzzle(app);

    expect((await request(app).post(`/api/puzzles/${id}/suggest`).set(alice)).status).toBe(503);
    expect((await request(app).post(`/api/puzzles/${id}/suggest`).set(bob)).status).toBe(404);
    expect((await request(testApp()).post(`/api/puzzles/${id}/suggest`).set(alice)).status).toBe(
      501,
    );
  });

  it('saves import hashes and clears the review flag with null', async () => {
    const app = testApp({ photos: fakePhotos() });
    const hash = 'a'.repeat(64);
    const id = await importPuzzle(app, { importHashes: [hash] });

    const res = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ needsReview: null });

    expect(res.body.importHashes).toEqual([hash]);
    expect(res.body.needsReview).toBeUndefined();
    const bad = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', importHashes: ['nope'] });
    expect(bad.status).toBe(400);
  });
});

describe('photo fingerprints', () => {
  it('stores one, and drops it when the photo is replaced', async () => {
    const app = testApp({ photos: fakePhotos() });
    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', imageKey: 'uploads/alice/a', photoFingerprint: '0123456789abcdef' });
    expect(created.body.photoFingerprint).toBe('0123456789abcdef');

    const notes = await request(app)
      .patch(`/api/puzzles/${created.body.id}`)
      .set(alice)
      .send({ notes: 'hi' });
    expect(notes.body.photoFingerprint).toBe('0123456789abcdef');

    const rotated = await request(app)
      .patch(`/api/puzzles/${created.body.id}`)
      .set(alice)
      .send({ imageKey: 'uploads/alice/b' });
    expect(rotated.body.photoFingerprint).toBeUndefined();

    const bad = await request(app)
      .patch(`/api/puzzles/${created.body.id}`)
      .set(alice)
      .send({ photoFingerprint: 'xyz' });
    expect(bad.status).toBe(400);
  });
});

describe('tag suggestions', () => {
  function tagsApp(
    suggestTags: PuzzleSuggester['suggestTags'] = async () => ['Disney', 'Castles'],
  ) {
    const suggester = { suggest: vi.fn(), suggestTags: vi.fn(suggestTags), readBox: vi.fn() };
    return { app: testApp({ photos: fakePhotos(), suggester }), suggester };
  }

  it("suggests tags from the title and the user's own photos", async () => {
    const { app, suggester } = tagsApp();
    await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Old', tags: ['Disney'] });

    const res = await request(app)
      .post('/api/suggestions/tags')
      .set(alice)
      .send({ title: 'Cinderella Castle', imageKeys: ['uploads/alice/box'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tags: ['Disney', 'Castles'] });
    expect(suggester.suggestTags).toHaveBeenCalledWith(
      {
        title: 'Cinderella Castle',
        brand: undefined,
        imageUrls: ['https://bucket.example/uploads/alice/box?signed'],
      },
      ['Disney'],
    );
  });

  it("rejects someone else's photo, an empty request, and reports outages", async () => {
    const { app } = tagsApp(async () => {
      throw new SuggestionUnavailableError('down');
    });
    const post = (body: object, user = alice) =>
      request(app).post('/api/suggestions/tags').set(user).send(body);

    expect((await post({ imageKeys: ['uploads/bob/x'] })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ title: 'x' })).status).toBe(503);
    expect((await request(app).post('/api/suggestions/tags').send({ title: 'x' })).status).toBe(
      401,
    );
    expect(
      (await request(testApp()).post('/api/suggestions/tags').set(alice).send({ title: 'x' }))
        .status,
    ).toBe(501);
  });
});

describe('box photos', () => {
  it('stores one with a viewing link, checks ownership, and cleans up replaced ones', async () => {
    const photos = fakePhotos();
    const app = testApp({ photos });
    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'Wish', status: 'wishlist', boxImageKey: 'uploads/alice/box1' });
    expect(created.body.boxImageUrl).toBe('https://bucket.example/uploads/alice/box1?signed');
    expect(created.body.imageUrl).toBeUndefined();

    const id = created.body.id as string;
    const replaced = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ boxImageKey: 'uploads/alice/box2' });
    expect(replaced.body.boxImageKey).toBe('uploads/alice/box2');
    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/box1');

    const removed = await request(app)
      .patch(`/api/puzzles/${id}`)
      .set(alice)
      .send({ boxImageKey: null });
    expect(removed.body.boxImageUrl).toBeUndefined();
    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/box2');

    const theirs = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', boxImageKey: 'uploads/bob/box' });
    expect(theirs.status).toBe(400);
  });

  it('deletes both photos with the puzzle', async () => {
    const photos = fakePhotos();
    const app = testApp({ photos });
    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', imageKey: 'uploads/alice/a', boxImageKey: 'uploads/alice/b' });

    await request(app).delete(`/api/puzzles/${created.body.id}`).set(alice);

    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/a');
    expect(photos.delete).toHaveBeenCalledWith('uploads/alice/b');
  });
});

describe('ratings', () => {
  it('stores a rating, difficulty, missing pieces and would-redo, and validates them', async () => {
    const app = testApp();
    const created = await request(app)
      .post('/api/puzzles')
      .set(alice)
      .send({ title: 'x', rating: 5, difficulty: 'hard', missingPieces: 2, wouldRedo: true });
    expect(created.body).toMatchObject({
      rating: 5,
      difficulty: 'hard',
      missingPieces: 2,
      wouldRedo: true,
    });

    const cleared = await request(app)
      .patch(`/api/puzzles/${created.body.id}`)
      .set(alice)
      .send({ rating: null, wouldRedo: null });
    expect(cleared.body.rating).toBeUndefined();
    expect(cleared.body.wouldRedo).toBeUndefined();

    for (const bad of [
      { rating: 6 },
      { rating: 0 },
      { difficulty: 'impossible' },
      { missingPieces: -1 },
    ]) {
      expect(
        (
          await request(app)
            .post('/api/puzzles')
            .set(alice)
            .send({ title: 'x', ...bad })
        ).status,
      ).toBe(400);
    }
  });
});

describe('reading a box', () => {
  function boxApp(readBox: PuzzleSuggester['readBox']) {
    const suggester = { suggest: vi.fn(), suggestTags: vi.fn(), readBox: vi.fn(readBox) };
    return { app: testApp({ photos: fakePhotos(), suggester }), suggester };
  }

  it("reads the user's own box photo", async () => {
    const { app, suggester } = boxApp(async () => ({ title: 'Paris Café', pieceCount: 1000 }));

    const res = await request(app)
      .post('/api/suggestions/box')
      .set(alice)
      .send({ imageKey: 'uploads/alice/box' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ title: 'Paris Café', pieceCount: 1000 });
    expect(suggester.readBox).toHaveBeenCalledWith(
      'https://bucket.example/uploads/alice/box?signed',
    );
  });

  it("rejects someone else's photo and reports outages", async () => {
    const { app } = boxApp(async () => {
      throw new SuggestionUnavailableError('down');
    });
    const post = (body: object) => request(app).post('/api/suggestions/box').set(alice).send(body);

    expect((await post({ imageKey: 'uploads/bob/x' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ imageKey: 'uploads/alice/x' })).status).toBe(503);
    expect(
      (await request(testApp()).post('/api/suggestions/box').set(alice).send({ imageKey: 'x' }))
        .status,
    ).toBe(501);
  });
});

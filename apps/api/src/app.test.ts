import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { PhotoStorage } from './photos/types.js';

describe('API', () => {
  it('reports health', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('creates and lists puzzles', async () => {
    const app = createApp();

    const created = await request(app)
      .post('/api/puzzles')
      .send({ title: 'Starry Night', pieceCount: 1000 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Starry Night', pieceCount: 1000 });

    const list = await request(app).get('/api/puzzles');
    expect(list.body).toHaveLength(1);
  });

  it('rejects an invalid puzzle', async () => {
    const res = await request(createApp()).post('/api/puzzles').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing puzzle', async () => {
    const res = await request(createApp()).get('/api/puzzles/nope');
    expect(res.status).toBe(404);
  });
});

describe('photo uploads', () => {
  const photos: PhotoStorage = {
    createUpload: async () => ({
      key: 'uploads/abc',
      url: 'https://bucket.example',
      fields: { key: 'uploads/abc' },
    }),
    getViewUrl: async (key) => `https://bucket.example/${key}?signed`,
  };

  it('returns 501 when uploads are not configured', async () => {
    const res = await request(createApp()).post('/api/uploads').send({ contentType: 'image/jpeg' });
    expect(res.status).toBe(501);
  });

  it('only issues uploads for images', async () => {
    const res = await request(createApp({ photos }))
      .post('/api/uploads')
      .send({ contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });

  it('issues an upload and returns a viewing URL for the saved puzzle', async () => {
    const app = createApp({ photos });

    const upload = await request(app).post('/api/uploads').send({ contentType: 'image/jpeg' });
    expect(upload.status).toBe(201);

    const created = await request(app)
      .post('/api/puzzles')
      .send({ title: 'With photo', imageKey: upload.body.key });
    expect(created.body.imageUrl).toBe('https://bucket.example/uploads/abc?signed');
  });

  it('rejects image keys outside the uploads folder', async () => {
    const res = await request(createApp({ photos }))
      .post('/api/puzzles')
      .send({ title: 'Sneaky', imageKey: '../secrets' });
    expect(res.status).toBe(400);
  });
});

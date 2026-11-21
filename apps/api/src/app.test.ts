import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

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

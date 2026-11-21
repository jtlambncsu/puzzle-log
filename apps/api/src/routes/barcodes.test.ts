import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { ResolveUser } from '../auth.js';
import { InMemoryBarcodeCache } from '../barcodes/cache.js';
import type { ProductLookup } from '../barcodes/types.js';
import { LookupUnavailableError } from '../barcodes/upcitemdb.js';

const signedIn: ResolveUser = () => 'alice';
const cinderella = { title: 'Ceaco Cinderella', brand: 'Ceaco', pieceCount: 1000 };

function setup(lookup: ProductLookup['lookup']) {
  const productLookup = { lookup: vi.fn(lookup) };
  const app = createApp({
    resolveUser: signedIn,
    productLookup,
    barcodeCache: new InMemoryBarcodeCache(),
  });
  return { app, productLookup };
}

describe('GET /api/barcodes/:code', () => {
  it('looks up a barcode once, normalizing UPC-A to EAN-13, then serves it from cache', async () => {
    const { app, productLookup } = setup(async () => cinderella);

    const first = await request(app).get('/api/barcodes/021081311144');
    const second = await request(app).get('/api/barcodes/0021081311144'); // same box as EAN-13

    expect(first.body).toEqual({ barcode: '0021081311144', product: cinderella });
    expect(second.body).toEqual(first.body);
    expect(productLookup.lookup).toHaveBeenCalledTimes(1);
    expect(productLookup.lookup).toHaveBeenCalledWith('0021081311144');
  });

  it('remembers unknown barcodes too', async () => {
    const { app, productLookup } = setup(async () => undefined);

    const res = await request(app).get('/api/barcodes/079346125678');
    await request(app).get('/api/barcodes/079346125678');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ barcode: '0079346125678' });
    expect(productLookup.lookup).toHaveBeenCalledTimes(1);
  });

  it("doesn't cache failures, so they're retried", async () => {
    const { app, productLookup } = setup(async () => {
      throw new LookupUnavailableError('rate limited');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await request(app).get('/api/barcodes/079346125678')).status).toBe(503);
    expect((await request(app).get('/api/barcodes/079346125678')).status).toBe(503);
    expect(productLookup.lookup).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid barcodes without calling the service', async () => {
    const { app, productLookup } = setup(async () => cinderella);
    expect((await request(app).get('/api/barcodes/021081311145')).status).toBe(400);
    expect(productLookup.lookup).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    const app = createApp({ resolveUser: () => undefined });
    expect((await request(app).get('/api/barcodes/021081311144')).status).toBe(401);
  });
});

describe('barcodes on puzzles', () => {
  it('stores a normalized barcode and rejects invalid ones', async () => {
    const app = createApp({ resolveUser: signedIn });
    const created = await request(app)
      .post('/api/puzzles')
      .send({ title: 'Cinderella', barcode: '021081311144' });
    expect(created.body.barcode).toBe('0021081311144');

    const bad = await request(app).post('/api/puzzles').send({ title: 'x', barcode: '123' });
    expect(bad.status).toBe(400);
  });
});

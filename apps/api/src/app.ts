import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { puzzlesRouter } from './routes/puzzles.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { uploadsRouter } from './routes/uploads.js';
import { barcodesRouter } from './routes/barcodes.js';
import { InMemoryBarcodeCache } from './barcodes/cache.js';
import type { BarcodeCache, ProductLookup } from './barcodes/types.js';
import { UpcItemDbLookup } from './barcodes/upcitemdb.js';
import { InMemoryPuzzleStore } from './stores/memory.js';
import type { PuzzleStore } from './stores/types.js';
import type { PhotoStorage } from './photos/types.js';
import type { PuzzleSuggester } from './suggestions/types.js';
import { requireUser, type ResolveUser } from './auth.js';

export interface AppDeps {
  /** How to identify the caller. Required, so no entry point can forget auth. */
  resolveUser: ResolveUser;
  store?: PuzzleStore;
  /** Omit to disable photo uploads (local development without AWS). */
  photos?: PhotoStorage;
  /** Origins allowed to call the API from a browser. Omit to allow any origin. */
  allowedOrigins?: string[];
  /** Barcode → product lookups. Defaults to UPCitemdb with an in-memory cache. */
  productLookup?: ProductLookup;
  barcodeCache?: BarcodeCache;
  /** Names imported puzzles from their photos. Omit to turn suggestions off. */
  suggester?: PuzzleSuggester;
  /** The time, for the puzzle timer. Tests pass a fixed clock. */
  clock?: () => Date;
}

export function createApp({
  resolveUser,
  store = new InMemoryPuzzleStore(),
  photos,
  allowedOrigins,
  productLookup = new UpcItemDbLookup(),
  barcodeCache = new InMemoryBarcodeCache(),
  suggester,
  clock = () => new Date(),
}: AppDeps) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins ?? '*' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Everything below needs a signed-in user. In AWS, API Gateway also rejects requests
  // without a valid token before they reach Lambda; this is a second line of defense.
  app.use('/api/puzzles', requireUser(resolveUser), puzzlesRouter(store, photos, clock, suggester));
  app.use(
    '/api/suggestions',
    requireUser(resolveUser),
    suggestionsRouter(store, photos, suggester),
  );
  app.use('/api/uploads', requireUser(resolveUser), uploadsRouter(photos));
  app.use('/api/barcodes', requireUser(resolveUser), barcodesRouter(productLookup, barcodeCache));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}

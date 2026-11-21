import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { puzzlesRouter } from './routes/puzzles.js';
import { uploadsRouter } from './routes/uploads.js';
import { InMemoryPuzzleStore } from './stores/memory.js';
import type { PuzzleStore } from './stores/types.js';
import type { PhotoStorage } from './photos/types.js';

export interface AppDeps {
  store?: PuzzleStore;
  /** Omit to disable photo uploads (local development without AWS). */
  photos?: PhotoStorage;
  /** Origins allowed to call the API from a browser. Omit to allow any origin. */
  allowedOrigins?: string[];
}

export function createApp({
  store = new InMemoryPuzzleStore(),
  photos,
  allowedOrigins,
}: AppDeps = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins ?? '*' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/puzzles', puzzlesRouter(store, photos));
  app.use('/api/uploads', uploadsRouter(photos));

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

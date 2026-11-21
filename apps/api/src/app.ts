import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { puzzlesRouter } from './routes/puzzles.js';
import { InMemoryPuzzleStore, type PuzzleStore } from './store.js';

export function createApp(store: PuzzleStore = new InMemoryPuzzleStore()) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/puzzles', puzzlesRouter(store));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}

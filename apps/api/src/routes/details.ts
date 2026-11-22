import { Router } from 'express';
import { createDetailsJobSchema, uniqueTags, type DetailsJob } from '@puzzle-log/shared';
import type { PhotoStorage } from '../photos/types.js';
import { processJob, type ProcessDeps } from '../details/process.js';
import { DetailsUnavailableError, type DetailsFinder } from '../details/types.js';

/** Time a request may spend saving results; API Gateway gives up after 30 seconds. */
const PROCESS_BUDGET_MS = 18_000;
/** How many past jobs the list returns. */
const RECENT_JOBS = 20;

/**
 * "Find details online", as batch jobs:
 * - `POST /api/details/jobs` sends up to 10 puzzles (with their photos) to a batch.
 * - `GET /api/details/jobs` lists jobs. When a batch has finished, it also saves the results
 *   onto the puzzles as proposals, so the web app's polling is what moves jobs along. No
 *   scheduler or queue needed.
 */
export function detailsRouter(
  deps: Omit<ProcessDeps, 'finder'> & { finder?: DetailsFinder; photos?: PhotoStorage },
) {
  const router = Router();
  const { finder, photos, jobs, puzzles } = deps;

  router.post('/jobs', async (req, res) => {
    const { userId } = res.locals;
    if (!finder || !photos) {
      res.status(501).json({ error: "Finding details isn't set up on this server" });
      return;
    }
    const result = createDetailsJobSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', issues: result.error.issues });
      return;
    }
    const all = await puzzles.list(userId);
    const chosen = result.data.puzzleIds.map((id) => all.find((puzzle) => puzzle.id === id));
    if (chosen.some((puzzle) => !puzzle?.imageKey)) {
      res.status(400).json({ error: 'Every puzzle must exist and have a photo' });
      return;
    }
    const knownTags = uniqueTags(all.flatMap((puzzle) => puzzle.tags ?? []));

    let batchId: string;
    try {
      const requests = await Promise.all(
        chosen.map(async (puzzle) => ({
          puzzleId: puzzle!.id,
          title: puzzle!.title,
          brand: puzzle!.brand,
          pieceCount: puzzle!.pieceCount,
          knownTags,
          photo: await photos.read(puzzle!.imageKey!),
        })),
      );
      batchId = await finder.start(requests);
    } catch (error) {
      if (!(error instanceof DetailsUnavailableError)) throw error;
      console.error(error);
      res.status(503).json({ error: 'Finding details is unavailable right now' });
      return;
    }

    const job: DetailsJob = {
      id: batchId,
      userId,
      puzzleIds: result.data.puzzleIds,
      createdAt: deps.now().toISOString(),
      status: 'processing',
      processedIds: [],
    };
    await jobs.put(job);
    res.status(201).json(job);
  });

  router.get('/jobs', async (_req, res) => {
    const { userId } = res.locals;
    const recent = (await jobs.list(userId)).slice(0, RECENT_JOBS);
    if (finder) {
      const deadline = deps.now().getTime() + PROCESS_BUDGET_MS;
      for (const [index, job] of recent.entries()) {
        if (job.status !== 'processing') continue;
        try {
          recent[index] = await processJob(job, { ...deps, finder }, deadline);
        } catch (error) {
          // A batch that can't be checked right now is checked again on the next poll.
          if (!(error instanceof DetailsUnavailableError)) throw error;
          console.error(error);
        }
      }
    }
    res.json(recent);
  });

  return router;
}

import { Router } from 'express';
import { createUploadSchema } from '@puzzle-log/shared';
import type { PhotoStorage } from '../photos/types.js';

export function uploadsRouter(photos?: PhotoStorage) {
  const router = Router();

  router.post('/', async (req, res) => {
    if (!photos) {
      res.status(501).json({ error: 'Photo uploads are not configured' });
      return;
    }
    const result = createUploadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid upload request', issues: result.error.issues });
      return;
    }
    res.status(201).json(await photos.createUpload(res.locals.userId, result.data.contentType));
  });

  return router;
}

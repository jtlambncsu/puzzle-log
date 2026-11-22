import { Router } from 'express';
import { normalizeBarcode, type BarcodeLookupResult } from '@puzzle-log/shared';
import { cachedLookup } from '../barcodes/cachedLookup.js';
import type { BarcodeCache, ProductLookup } from '../barcodes/types.js';
import { LookupUnavailableError } from '../barcodes/upcitemdb.js';

/**
 * `GET /api/barcodes/:code` → what product a barcode is. Matching it against the user's own
 * puzzles happens in the browser, which already has their list.
 */
export function barcodesRouter(lookup: ProductLookup, cache: BarcodeCache) {
  const router = Router();
  const find = cachedLookup(lookup, cache);

  router.get('/:code', async (req, res) => {
    const barcode = normalizeBarcode(req.params.code);
    if (!barcode) {
      res.status(400).json({ error: 'Not a valid barcode' });
      return;
    }

    try {
      res.json({ barcode, product: await find(barcode) } satisfies BarcodeLookupResult);
    } catch (error) {
      if (!(error instanceof LookupUnavailableError)) throw error;
      console.error(error);
      // Not cached, so it's retried next time. The client still checks the user's own list.
      res.status(503).json({ error: "Couldn't look up this barcode right now" });
    }
  });

  return router;
}

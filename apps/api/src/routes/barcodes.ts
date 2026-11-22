import { Router } from 'express';
import { normalizeBarcode, type BarcodeLookupResult } from '@puzzle-log/shared';
import type { BarcodeCache, ProductLookup } from '../barcodes/types.js';
import { LookupUnavailableError } from '../barcodes/upcitemdb.js';

const DAY = 24 * 60 * 60;
/** Product data rarely changes; unknown barcodes may be added to the database later. */
const FOUND_TTL = 30 * DAY;
const NOT_FOUND_TTL = DAY;

/**
 * `GET /api/barcodes/:code` → what product a barcode is. Matching it against the user's own
 * puzzles happens in the browser, which already has their list.
 */
export function barcodesRouter(lookup: ProductLookup, cache: BarcodeCache) {
  const router = Router();

  router.get('/:code', async (req, res) => {
    const barcode = normalizeBarcode(req.params.code);
    if (!barcode) {
      res.status(400).json({ error: 'Not a valid barcode' });
      return;
    }

    const cached = await cache.get(barcode);
    if (cached) {
      res.json({ barcode, product: cached.product } satisfies BarcodeLookupResult);
      return;
    }

    try {
      const product = await lookup.lookup(barcode);
      await cache.set(barcode, { product }, product ? FOUND_TTL : NOT_FOUND_TTL);
      res.json({ barcode, product } satisfies BarcodeLookupResult);
    } catch (error) {
      if (!(error instanceof LookupUnavailableError)) throw error;
      console.error(error);
      // Not cached, so it's retried next time. The client still checks the user's own list.
      res.status(503).json({ error: "Couldn't look up this barcode right now" });
    }
  });

  return router;
}

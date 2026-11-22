import type { ProductInfo } from '@puzzle-log/shared';
import type { BarcodeCache, ProductLookup } from './types.js';

const DAY = 24 * 60 * 60;
/** Product data rarely changes; unknown barcodes may be added to the database later. */
const FOUND_TTL = 30 * DAY;
const NOT_FOUND_TTL = DAY;

/**
 * Looks a barcode up, through the cache, so each barcode costs at most one call to the
 * outside service (UPCitemdb's free tier allows about 100 a day). Throws
 * `LookupUnavailableError` if the service can't answer; that isn't cached.
 */
export function cachedLookup(lookup: ProductLookup, cache: BarcodeCache) {
  return async (barcode: string): Promise<ProductInfo | undefined> => {
    const cached = await cache.get(barcode);
    if (cached) return cached.product;
    const product = await lookup.lookup(barcode);
    await cache.set(barcode, { product }, product ? FOUND_TTL : NOT_FOUND_TTL);
    return product;
  };
}

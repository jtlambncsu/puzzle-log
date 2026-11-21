import type { ProductInfo } from '@puzzle-log/shared';

/** Looks up what product a barcode belongs to (e.g. UPCitemdb). */
export interface ProductLookup {
  /** `undefined` if the barcode is unknown. Throws if the service can't answer. */
  lookup(barcode: string): Promise<ProductInfo | undefined>;
}

export interface CachedLookup {
  product?: ProductInfo;
}

/** Remembers lookups so each barcode costs at most one call to the outside service. */
export interface BarcodeCache {
  get(barcode: string): Promise<CachedLookup | undefined>;
  /** `ttlSeconds`: how long to remember it. */
  set(barcode: string, entry: CachedLookup, ttlSeconds: number): Promise<void>;
}

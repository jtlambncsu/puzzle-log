import type { ProductInfo } from '@puzzle-log/shared';
import type { ProductLookup } from './types.js';

export class LookupUnavailableError extends Error {}

interface UpcItemDbResponse {
  code: string;
  items?: { title?: string; brand?: string; images?: string[] }[];
}

/** "Ceaco 1000 Piece Cinderella…" → 1000. Product titles usually include the count. */
export function pieceCountFromTitle(title: string): number | undefined {
  const match = title.match(/\b(\d{2,5})[\s-]*(?:pc|pcs|pce|piece|pieces)\b/i);
  return match ? Number(match[1]) : undefined;
}

/**
 * UPCitemdb's free trial API: no key, about 100 lookups a day, plenty for one person with
 * caching. Swap in a paid plan or another provider by implementing `ProductLookup`.
 */
export class UpcItemDbLookup implements ProductLookup {
  constructor(
    private readonly baseUrl = 'https://api.upcitemdb.com/prod/trial/lookup',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async lookup(barcode: string): Promise<ProductInfo | undefined> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}?upc=${encodeURIComponent(barcode)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new LookupUnavailableError('Barcode lookup timed out or failed', { cause: error });
    }
    // 404 / 400 mean "not a known product"; 429 means we're over the daily limit.
    if (res.status === 404 || res.status === 400) return undefined;
    if (!res.ok) throw new LookupUnavailableError(`Barcode lookup failed: ${res.status}`);

    const body = (await res.json()) as UpcItemDbResponse;
    const item = body.items?.[0];
    if (!item?.title) return undefined;
    const title = item.title.replace(/\s+/g, ' ').trim();
    return {
      title,
      brand: item.brand?.trim() || undefined,
      pieceCount: pieceCountFromTitle(title),
      imageUrl: item.images?.find((url) => url.startsWith('https://')),
    };
  }
}

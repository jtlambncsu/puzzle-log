import { z } from 'zod';

/** True if the last digit is the correct GS1 check digit for the others. */
export function hasValidCheckDigit(digits: string) {
  const body = digits.slice(0, -1);
  const sum = [...body]
    .reverse()
    .reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/**
 * Turns a scanned or typed barcode into one canonical form, or `undefined` if it isn't a
 * valid product barcode. US boxes use 12-digit UPC-A, which is the same number as a 13-digit
 * EAN-13 with a leading zero; scanners report either, so both become the 13-digit form.
 * EAN-8 codes are kept as they are.
 */
export function normalizeBarcode(input: string): string | undefined {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return undefined;
  const normalized = digits.length === 12 ? `0${digits}` : digits;
  if (normalized.length !== 13 && normalized.length !== 8) return undefined;
  return hasValidCheckDigit(normalized) ? normalized : undefined;
}

export const barcodeSchema = z.string().transform((value, ctx) => {
  const barcode = normalizeBarcode(value);
  if (!barcode) {
    ctx.addIssue({ code: 'custom', message: 'Not a valid barcode' });
    return z.NEVER;
  }
  return barcode;
});

/** What a barcode lookup service knows about a product. */
export interface ProductInfo {
  title: string;
  brand?: string;
  pieceCount?: number;
  imageUrl?: string;
}

/** `GET /api/barcodes/:code` */
export interface BarcodeLookupResult {
  barcode: string;
  /** `undefined` when no database knows this barcode. */
  product?: ProductInfo;
}

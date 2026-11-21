# 0019. Barcode scanning: browser decoder, own barcodes first, cached UPCitemdb lookup

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The main real-world question is "have I already done this puzzle?" while holding a box in a
shop. Every box has a UPC/EAN barcode. The owner's existing puzzles were logged from photos
of finished puzzles, so most have no barcode saved yet.

A test with three of the owner's boxes: UPCitemdb identified 2 of 3 (LEGO, Ceaco), not a
Buffalo Games box. Open Products Facts identified none.

## Decision

**Scan in the browser** (`/scan`) with `@yudiel/react-qr-scanner`, the popular React wrapper
around the `barcode-detector` polyfill, which decodes with ZXing compiled to WebAssembly.
iPhone Safari has no native `BarcodeDetector`, so a WASM decoder is required. The WASM file is
**self-hosted** (bundled by Vite and wired in with `setZXingModuleOverrides`) instead of being
fetched from a public CDN. Only UPC/EAN formats are enabled, and codes with a bad check digit
are ignored, which filters misreads. Typing the number is always offered as a fallback.

**Normalize barcodes** to 13 digits (`normalizeBarcode` in `packages/shared`): a 12-digit
UPC-A is the same product as the EAN-13 with a leading zero, and scanners report either.

**Decide in this order** (`/scan/$barcode`):

1. **The user's own puzzles** with that barcode: instant and certain. Shown without waiting
   for any lookup.
2. Otherwise **look the barcode up** (`GET /api/barcodes/:code` → UPCitemdb's free trial API)
   and suggest the user's puzzles whose titles share the product title's meaningful words
   (`rankBySimilarity`), plus a search over the whole log.
3. **"This one"** saves the barcode on the picked puzzle (PATCH), so the next scan is case 1.
   **"Add it"** opens the add form pre-filled from the lookup (via URL search params).

**The API owns the lookup**: clients never call UPCitemdb directly, so a paid key could be
added later without shipping it to browsers. Results are cached in a DynamoDB table with TTL:
30 days for found products, 1 day for unknown codes; failures (rate limits, timeouts) aren't
cached, so they're retried.

## Alternatives considered

- **Matching only saved barcodes** — certain, but useless for the existing backlog.
- **Calling UPCitemdb from the browser** — no server work, but no shared cache and no way to
  keep a key secret.
- **Paid lookup APIs** (Barcode Lookup, Go-UPC) — better coverage; worth it if the free tier's
  gaps or ~100 lookups/day become a problem. The `ProductLookup` interface makes it a swap.
- **`html5-qrcode` / `@zxing/browser`** — older or less maintained; the chosen stack uses the
  standard `BarcodeDetector` API shape, so it'll use native detection where browsers add it.
- **Native app (Expo) scanning** — better camera control, but the web app works today on the
  owner's phone. The same API and matching logic will serve a future mobile app.

## Consequences

- Scans of boxes whose barcode is saved are instant and offline-friendly (list is cached).
- Coverage of the lookup varies by brand; the UI always falls back to search-by-name.
- The scanner chunk and ~400 KB (gzipped) WASM file load only on `/scan`.
- The cache table is disposable (`RemovalPolicy.DESTROY`): it refills from the lookup service.

## Explaining it in an interview

"Scanning runs entirely in the browser with a WebAssembly ZXing decoder, since iOS Safari has
no BarcodeDetector. The result page checks the user's own saved barcodes first, which is
instant and certain, and only then calls our API, which proxies and caches a product database
lookup in DynamoDB with TTLs. When a lookup finds the product, I rank the user's puzzles by
shared title words and let them confirm a match, which saves the barcode, so the system gets
more accurate the more it's used."

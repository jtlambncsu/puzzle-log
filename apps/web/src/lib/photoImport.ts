import { readPhotoTakenAt } from './photoDate';

/**
 * Finding duplicates in a pile of camera-roll photos, before anything is uploaded.
 *
 * Two kinds of duplicate:
 * - **Exact copies** (the same file saved twice) have the same SHA-256 hash.
 * - **Re-shoots** (several photos of one finished puzzle) differ byte for byte but look
 *   alike. A "difference hash" captures how a picture looks in 64 bits: shrink it to 9×8
 *   grey pixels and record, for each pixel, whether it's brighter than its right neighbour.
 *   Similar pictures differ in only a few of those bits (their Hamming distance).
 */

export interface AnalyzedPhoto {
  file: File;
  /** SHA-256 of the file, hex. Also saved on the puzzle, so a re-import skips it. */
  hash: string;
  /** Difference hash, or undefined if the browser couldn't decode the image. */
  fingerprint?: bigint;
  /** `YYYY-MM-DDTHH:MM:SS` in the camera's local time, from EXIF. */
  takenAt?: string;
}

export async function analyzePhoto(file: File): Promise<AnalyzedPhoto> {
  const bytes = await file.arrayBuffer();
  const [hash, takenAt, fingerprint] = await Promise.all([
    sha256Hex(bytes),
    readPhotoTakenAt(bytes),
    differenceHash(file),
  ]);
  return { file, hash, takenAt, fingerprint };
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function differenceHash(file: Blob): Promise<bigint | undefined> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const grey = shrinkToGrey(bitmap, 9, 8);
    bitmap.close(); // free the full-size image right away: there may be hundreds
    if (!grey) return undefined;
    let hash = 0n;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        hash = (hash << 1n) | (grey[y * 9 + x]! > grey[y * 9 + x + 1]! ? 1n : 0n);
      }
    }
    return hash;
  } catch {
    return undefined; // jsdom, or a format this browser can't decode
  }
}

/**
 * Shrinks an image to `width`×`height` grey values, averaging every pixel. Drawing a large
 * photo straight onto a 9×8 canvas would sample only a few pixels, so the result would be
 * mostly noise (two shots of the same puzzle came out 28 bits apart instead of 5). Instead:
 * halve the image until it's small (each halving averages 2×2 pixels), draw it at 8 pixels
 * per cell, and average each cell here.
 */
function shrinkToGrey(image: ImageBitmap, width: number, height: number) {
  const CELL = 8;
  const [targetW, targetH] = [width * CELL, height * CELL];
  let source: CanvasImageSource = image;
  let [w, h] = [image.width, image.height];
  while (w / 2 >= targetW && h / 2 >= targetH) {
    [w, h] = [Math.round(w / 2), Math.round(h / 2)];
    source = drawn(source, w, h);
  }
  const { data } = drawn(source, targetW, targetH)
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, targetW, targetH);
  const grey = new Float64Array(width * height);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const luma = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      grey[Math.floor(y / CELL) * width + Math.floor(x / CELL)]! += luma;
    }
  }
  return grey;
}

function drawn(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  Object.assign(canvas, { width, height });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** How many of the 64 bits differ: 0 is identical-looking, around 32 is unrelated. */
export function fingerprintDistance(a: bigint, b: bigint) {
  let diff = a ^ b;
  let count = 0;
  while (diff) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

/**
 * Near-identical pictures: the same shot, or one taken a moment later. Measured on test
 * photos: a slightly cropped, brighter re-shoot was 5 bits away; different puzzles, 21 to 35.
 */
const SAME_PICTURE = 10;
/** Looser match for photos taken within a few minutes of each other. */
const SIMILAR_PICTURE = 16;
const SAME_SESSION_MS = 10 * 60_000;

function takenAtMs(photo: AnalyzedPhoto) {
  // Camera-local time, read as UTC: only the difference between two photos matters.
  return photo.takenAt ? Date.parse(`${photo.takenAt}Z`) : undefined;
}

export function looksLikeSamePuzzle(a: AnalyzedPhoto, b: AnalyzedPhoto) {
  if (a.fingerprint === undefined || b.fingerprint === undefined) return false;
  const distance = fingerprintDistance(a.fingerprint, b.fingerprint);
  if (distance <= SAME_PICTURE) return true;
  const [timeA, timeB] = [takenAtMs(a), takenAtMs(b)];
  return (
    distance <= SIMILAR_PICTURE &&
    timeA !== undefined &&
    timeB !== undefined &&
    Math.abs(timeA - timeB) <= SAME_SESSION_MS
  );
}

/** One puzzle to import: its photos, the one to keep, and the date. */
export interface PhotoGroup {
  photos: AnalyzedPhoto[];
  /** The photo to upload: the largest file, usually the sharpest. */
  best: AnalyzedPhoto;
  /** The day of the earliest photo, `YYYY-MM-DD`. */
  date?: string;
}

export interface GroupingResult {
  groups: PhotoGroup[];
  /** Files that were exact copies of another picked file. */
  exactCopies: number;
  /** Files already imported earlier (their hash is saved on a puzzle). */
  alreadyImported: number;
}

/**
 * Groups photos that show the same puzzle. Pairs are compared directly (a few hundred photos
 * is tens of thousands of comparisons, which is instant), and matches are joined with a
 * union-find, so if A matches B and B matches C, all three are one group.
 */
export function groupPhotos(
  photos: readonly AnalyzedPhoto[],
  importedHashes: ReadonlySet<string> = new Set(),
): GroupingResult {
  const seen = new Set<string>();
  let exactCopies = 0;
  let alreadyImported = 0;
  const unique: AnalyzedPhoto[] = [];
  for (const photo of photos) {
    if (importedHashes.has(photo.hash)) alreadyImported++;
    else if (seen.has(photo.hash)) exactCopies++;
    else unique.push(photo);
    seen.add(photo.hash);
  }

  const parent = unique.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (looksLikeSamePuzzle(unique[i]!, unique[j]!)) parent[root(j)] = root(i);
    }
  }

  const byRoot = new Map<number, AnalyzedPhoto[]>();
  unique.forEach((photo, i) => byRoot.set(root(i), [...(byRoot.get(root(i)) ?? []), photo]));
  const groups = [...byRoot.values()].map(makeGroup);
  // Oldest first (undated last), so the review screen goes through them in order.
  groups.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  return { groups, exactCopies, alreadyImported };
}

export function makeGroup(photos: AnalyzedPhoto[]): PhotoGroup {
  const best = photos.reduce((a, b) => (b.file.size > a.file.size ? b : a));
  const times = photos.flatMap((photo) => (photo.takenAt ? [photo.takenAt] : [])).sort();
  return { photos, best, date: times[0]?.slice(0, 10) };
}

import type { Puzzle } from '@puzzle-log/shared';
import { readPhotoTakenAt } from './photoDate';

/**
 * Finding duplicates in a pile of camera-roll photos, before anything is uploaded, and
 * against the puzzles already saved.
 *
 * Two kinds of duplicate:
 * - **Exact copies** (the same file saved twice) have the same SHA-256 hash.
 * - **Look-alikes** (several shots of one finished puzzle, or the same photo re-encoded by
 *   the phone's picker) differ byte for byte but look alike. A "difference hash" captures
 *   how a picture looks in 64 bits: shrink it to 9×8 grey cells and record, for each cell,
 *   whether it's brighter than its right neighbour. Similar pictures differ in only a few
 *   of those bits (their Hamming distance).
 *
 * Photos can be saved rotated (the review screen rotates them), so every photo also gets the
 * fingerprints of its three other orientations, and comparisons take the closest.
 */

/** A picture's fingerprints: upright first, then rotated 90°, 180° and 270°. */
export type Fingerprints = readonly bigint[];

export interface AnalyzedPhoto {
  file: File;
  /** SHA-256 of the file, hex. Saved on the puzzle, so a re-import skips the same file. */
  hash: string;
  /** Undefined if the browser couldn't decode the image. */
  fingerprints?: Fingerprints;
  /** A small JPEG for showing the photo without decoding the full-size file again. */
  thumbnail?: Blob;
  /** `YYYY-MM-DDTHH:MM:SS` in the camera's local time, from EXIF. */
  takenAt?: string;
}

export async function analyzePhoto(file: File): Promise<AnalyzedPhoto> {
  const bytes = await file.arrayBuffer();
  const [hash, takenAt, look] = await Promise.all([
    sha256Hex(bytes),
    readPhotoTakenAt(bytes),
    fingerprintImage(file),
  ]);
  return { file, hash, takenAt, ...look };
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const THUMBNAIL_SIZE = 320;
const GRID = { width: 9, height: 8 };
/** Pixels averaged per grid cell, in each direction. */
const CELL = 8;

/**
 * Fingerprints and a thumbnail for an image, or undefined where images can't be decoded
 * (jsdom in tests, or a format this browser doesn't support).
 *
 * Drawing a large photo straight onto a 9×8 canvas would sample only a few pixels, so the
 * result would be mostly noise. Instead the image is halved step by step (each halving
 * averages 2×2 pixels), then each grid cell is averaged here.
 */
export async function fingerprintImage(
  image: Blob,
): Promise<{ fingerprints: Fingerprints; thumbnail?: Blob } | undefined> {
  let bitmap: ImageBitmap | undefined;
  const canvases: HTMLCanvasElement[] = [];
  try {
    bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
    const thumbnailCanvas = halveUntil(bitmap, THUMBNAIL_SIZE, canvases);
    bitmap.close(); // free the full-size image right away: there may be hundreds
    bitmap = undefined;
    const small = halveUntil(thumbnailCanvas, GRID.width * CELL * 2, canvases);
    const fingerprints = [0, 90, 180, 270].map((degrees) =>
      differenceHash(greyGrid(small, degrees, canvases)),
    );
    const thumbnail = await new Promise<Blob | null>((resolve) =>
      thumbnailCanvas.toBlob(resolve, 'image/jpeg', 0.7),
    );
    return { fingerprints, thumbnail: thumbnail ?? undefined };
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
    // Safari limits the canvas memory a page can hold and frees it lazily; zero-sized
    // canvases release theirs at once.
    for (const canvas of canvases) Object.assign(canvas, { width: 0, height: 0 });
  }
}

function newCanvas(width: number, height: number, canvases: HTMLCanvasElement[]) {
  const canvas = document.createElement('canvas');
  Object.assign(canvas, { width, height });
  canvases.push(canvas);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No canvas');
  context.imageSmoothingQuality = 'high';
  return { canvas, context };
}

/** Halves an image until its longest side is at most `maxSide` (at least one draw). */
function halveUntil(
  source: ImageBitmap | HTMLCanvasElement,
  maxSide: number,
  canvases: HTMLCanvasElement[],
) {
  let current: ImageBitmap | HTMLCanvasElement = source;
  let [w, h] = [source.width, source.height];
  do {
    const scale = Math.max(0.5, Math.min(1, maxSide / Math.max(w, h)));
    [w, h] = [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
    const { canvas, context } = newCanvas(w, h, canvases);
    context.drawImage(current, 0, 0, w, h);
    current = canvas;
  } while (Math.max(w, h) > maxSide);
  return current as HTMLCanvasElement;
}

/** The image turned by `degrees`, as 9×8 average grey values. */
function greyGrid(source: HTMLCanvasElement, degrees: number, canvases: HTMLCanvasElement[]) {
  const [w, h] = [GRID.width * CELL, GRID.height * CELL];
  const { context } = newCanvas(w, h, canvases);
  // Rotate around the centre; for quarter turns, draw with width and height swapped so the
  // turned image still fills the canvas.
  context.translate(w / 2, h / 2);
  context.rotate((degrees * Math.PI) / 180);
  const sideways = degrees % 180 !== 0;
  const [dw, dh] = sideways ? [h, w] : [w, h];
  context.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  const { data } = context.getImageData(0, 0, w, h);
  const grey = new Float64Array(GRID.width * GRID.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const luma = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      grey[Math.floor(y / CELL) * GRID.width + Math.floor(x / CELL)]! += luma;
    }
  }
  return grey;
}

function differenceHash(grey: Float64Array) {
  let hash = 0n;
  for (let y = 0; y < GRID.height; y++) {
    for (let x = 0; x < GRID.width - 1; x++) {
      const i = y * GRID.width + x;
      hash = (hash << 1n) | (grey[i]! > grey[i + 1]! ? 1n : 0n);
    }
  }
  return hash;
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

/** Distance between two pictures in their closest orientation. */
export function lookDistance(a: Fingerprints, b: Fingerprints) {
  return Math.min(...b.map((rotated) => fingerprintDistance(a[0]!, rotated)));
}

export function fingerprintToHex(fingerprint: bigint) {
  return fingerprint.toString(16).padStart(16, '0');
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
  if (!a.fingerprints || !b.fingerprints) return false;
  const distance = lookDistance(a.fingerprints, b.fingerprints);
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

/** A photo that looks like a puzzle already in the log. */
export interface LooksImported {
  photo: AnalyzedPhoto;
  puzzle: Puzzle;
}

export interface GroupingResult {
  groups: PhotoGroup[];
  /** Files that were exact copies of another picked file. */
  exactCopies: number;
  /** Files already imported (their hash is saved on a puzzle). */
  alreadyImported: number;
  /** Photos that look like a saved puzzle's photo: skipped unless the user says otherwise. */
  looksImported: LooksImported[];
}

/** What's already in the log, to skip. */
export interface Existing {
  importHashes: ReadonlySet<string>;
  puzzles: readonly { puzzle: Puzzle; fingerprints: Fingerprints }[];
}

/** Indexes saved puzzles' import hashes and photo fingerprints. */
export function existingFrom(puzzles: readonly Puzzle[]): Existing {
  return {
    importHashes: new Set(puzzles.flatMap((puzzle) => puzzle.importHashes ?? [])),
    puzzles: puzzles.flatMap((puzzle) =>
      puzzle.photoFingerprint
        ? [{ puzzle, fingerprints: [BigInt(`0x${puzzle.photoFingerprint}`)] }]
        : [],
    ),
  };
}

/**
 * Groups photos that show the same puzzle, after setting aside exact copies and photos
 * already in the log. Pairs are compared directly (a few hundred photos is tens of
 * thousands of comparisons, which is instant), and matches are joined with a union-find,
 * so if A matches B and B matches C, all three are one group.
 */
export function groupPhotos(
  photos: readonly AnalyzedPhoto[],
  existing: Existing = { importHashes: new Set(), puzzles: [] },
): GroupingResult {
  const seen = new Set<string>();
  let exactCopies = 0;
  let alreadyImported = 0;
  const looksImported: LooksImported[] = [];
  const unique: AnalyzedPhoto[] = [];
  for (const photo of photos) {
    const match = photo.fingerprints && closestSaved(photo.fingerprints, existing);
    if (existing.importHashes.has(photo.hash)) alreadyImported++;
    else if (seen.has(photo.hash)) exactCopies++;
    else if (match) looksImported.push({ photo, puzzle: match });
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
  return { groups, exactCopies, alreadyImported, looksImported };
}

/** The saved puzzle whose photo this one looks like (nearly identical), if any. */
function closestSaved(fingerprints: Fingerprints, existing: Existing) {
  let best: { puzzle: Puzzle; distance: number } | undefined;
  for (const saved of existing.puzzles) {
    // The new photo in each orientation, against the saved photo as stored.
    const distance = lookDistance(saved.fingerprints, fingerprints);
    if (distance <= SAME_PICTURE && (!best || distance < best.distance)) {
      best = { puzzle: saved.puzzle, distance };
    }
  }
  return best?.puzzle;
}

export function makeGroup(photos: AnalyzedPhoto[]): PhotoGroup {
  const best = photos.reduce((a, b) => (b.file.size > a.file.size ? b : a));
  const times = photos.flatMap((photo) => (photo.takenAt ? [photo.takenAt] : [])).sort();
  return { photos, best, date: times[0]?.slice(0, 10) };
}

import Papa from 'papaparse';
import { puzzleStatus, totalTimeMs, type Puzzle } from '@puzzle-log/shared';

/** Starts the file so Excel reads accented characters as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** How many photos go in one zip: about 40 MB, which a phone can hold while zipping. */
export const PHOTOS_PER_ZIP = 40;

/**
 * A file name for a puzzle's photo inside the zip, readable and unique:
 * "hogwarts-at-night-1a2b3c4d.jpg". The same name is in the spreadsheet's Photo column.
 */
export function photoFileName(
  puzzle: Pick<Puzzle, 'id' | 'title'>,
  kind: 'photo' | 'box' = 'photo',
) {
  const slug = puzzle.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${slug || 'puzzle'}-${puzzle.id.slice(0, 8)}${kind === 'box' ? '-box' : ''}.jpg`;
}

/**
 * The whole log as a spreadsheet (CSV, which Excel, Numbers and Google Sheets open). Papa
 * Parse handles the escaping: commas, quotes and line breaks inside notes stay intact.
 */
export function puzzlesToCsv(puzzles: readonly Puzzle[], now = Date.now()) {
  const rows = puzzles.map((puzzle) => {
    const ms = totalTimeMs(puzzle, now);
    return {
      Title: puzzle.title,
      Status: puzzleStatus(puzzle),
      Brand: puzzle.brand ?? '',
      Pieces: puzzle.pieceCount ?? '',
      Started: puzzle.startedAt ?? '',
      Finished: puzzle.completedAt ?? '',
      'Hours spent': ms ? (ms / 3_600_000).toFixed(1) : '',
      Tags: (puzzle.tags ?? []).join('; '),
      Barcode: puzzle.barcode ?? '',
      Notes: puzzle.notes ?? '',
      Added: puzzle.createdAt.slice(0, 10),
      Photo: puzzle.imageKey ? photoFileName(puzzle) : '',
      'Box photo': puzzle.boxImageKey ? photoFileName(puzzle, 'box') : '',
    };
  });
  return BYTE_ORDER_MARK + Papa.unparse(rows);
}

/** One photo to put in a zip: where to download it, and its name in the zip. */
export interface PhotoEntry {
  url: string;
  name: string;
}

/** Every photo (finished and box), split into zip-sized parts. */
export function photoParts(puzzles: readonly Puzzle[]) {
  const entries: PhotoEntry[] = puzzles.flatMap((puzzle) => [
    ...(puzzle.imageUrl ? [{ url: puzzle.imageUrl, name: photoFileName(puzzle) }] : []),
    ...(puzzle.boxImageUrl
      ? [{ url: puzzle.boxImageUrl, name: photoFileName(puzzle, 'box') }]
      : []),
  ]);
  const parts: PhotoEntry[][] = [];
  for (let i = 0; i < entries.length; i += PHOTOS_PER_ZIP) {
    parts.push(entries.slice(i, i + PHOTOS_PER_ZIP));
  }
  return parts;
}

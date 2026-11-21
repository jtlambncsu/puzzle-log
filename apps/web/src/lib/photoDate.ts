/**
 * Reads the date a photo was taken from its EXIF metadata, as `YYYY-MM-DD`, or `undefined`
 * if it has none (screenshots, edited or downloaded images, some messaging apps).
 *
 * Must run on the *original* file: `compressImage` re-encodes photos, which strips EXIF.
 * The EXIF library is loaded on demand, the first time a photo is picked.
 */
export async function readPhotoDate(file: Blob): Promise<string | undefined> {
  return parseExifDate(await readExifDateTime(await file.arrayBuffer()));
}

/**
 * When a photo was taken, as `YYYY-MM-DDTHH:MM:SS` in the camera's local time (no time zone),
 * or `undefined`. Takes the file's bytes, so a caller that already read them (to hash them,
 * say) doesn't read the file twice.
 */
export async function readPhotoTakenAt(bytes: ArrayBuffer): Promise<string | undefined> {
  const match = (await readExifDateTime(bytes))?.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match || !parseExifDate(match[0])) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

async function readExifDateTime(bytes: ArrayBuffer) {
  try {
    const { default: ExifReader } = await import('exifreader');
    // Pass bytes, never a string: the library treats strings as URLs or file paths.
    const tags = ExifReader.load(bytes);
    return (
      tags.DateTimeOriginal?.description ??
      tags.DateTimeDigitized?.description ??
      tags.DateTime?.description
    );
  } catch {
    return undefined; // not an image the library understands: just skip the date
  }
}

/**
 * EXIF dates look like "2026:11:14 18:32:10" in the camera's local time, with no time zone.
 * Taking the date part as-is gives the day the photo was taken where it was taken; going
 * through `new Date()` could shift it by a day.
 */
export function parseExifDate(value?: string): string | undefined {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  if (year === '0000' || month === '00' || day === '00') return undefined; // "unset" in EXIF
  return `${year}-${month}-${day}`;
}

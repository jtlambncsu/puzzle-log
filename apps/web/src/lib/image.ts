/** Clockwise rotation in degrees. */
export type Rotation = 0 | 90 | 180 | 270;

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/** A quarter turn swaps width and height. */
export function rotatedSize(width: number, height: number, rotation: Rotation) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

interface CompressOptions {
  /** Rotate the pixels clockwise, so the saved photo is upright everywhere it's shown. */
  rotation?: Rotation;
  maxDimension?: number;
  quality?: number;
}

/**
 * Shrinks (and optionally rotates) a photo before upload: phone cameras produce 3-12 MB
 * images, which are slow to upload on mobile data and much bigger than a puzzle log needs.
 * Re-encoding through a canvas also strips EXIF metadata (like GPS location).
 *
 * Without rotation, falls back to the original file if the browser can't decode it (e.g. HEIC
 * outside Safari). With rotation it throws instead, since the result would be wrong.
 */
export async function compressImage(
  file: Blob,
  { rotation = 0, maxDimension = 2000, quality = 0.85 }: CompressOptions = {},
): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined') throw new Error('No image decoding');
    // 'from-image' applies the EXIF orientation first, matching what <img> previews show.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    Object.assign(canvas, rotatedSize(width, height, rotation));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas');
    // Rotate around the canvas centre, then draw the image centred on it.
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('Could not encode the photo');
    return rotation || blob.size < file.size ? blob : file;
  } catch (error) {
    if (rotation) throw new Error("Couldn't rotate this photo", { cause: error });
    return file;
  }
}

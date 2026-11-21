/**
 * Shrinks a photo before upload: phone cameras produce 3-12 MB images, which are slow to
 * upload on mobile data and much bigger than a puzzle log needs. Re-encoding through a
 * canvas also strips EXIF metadata (like GPS location) from the uploaded file.
 *
 * Falls back to the original file if the browser can't decode it (e.g. HEIC outside Safari).
 */
export async function compressImage(
  file: File,
  maxDimension = 2000,
  quality = 0.85,
): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') return file;
  try {
    // 'from-image' applies the EXIF rotation, so portrait photos stay upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

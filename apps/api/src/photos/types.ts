import type { UploadTarget } from '@puzzle-log/shared';

export interface PhotoStorage {
  /** Create a short-lived upload, under the user's own folder, sent straight to storage. */
  createUpload(userId: string, contentType: string): Promise<UploadTarget>;
  /** Short-lived URL for viewing a stored photo. */
  getViewUrl(key: string): Promise<string>;
  /** Reads a stored photo, e.g. to send it to an AI batch job. */
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Deletes a stored photo. Deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
}

/** Photos are stored under `uploads/<userId>/`, so ownership can be checked from the key. */
export function photoKeyPrefix(userId: string) {
  return `uploads/${userId}/`;
}

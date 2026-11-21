import type { UploadTarget } from '@puzzle-log/shared';

export interface PhotoStorage {
  /** Create a short-lived upload, under the user's own folder, sent straight to storage. */
  createUpload(userId: string, contentType: string): Promise<UploadTarget>;
  /** Short-lived URL for viewing a stored photo. */
  getViewUrl(key: string): Promise<string>;
}

/** Photos are stored under `uploads/<userId>/`, so ownership can be checked from the key. */
export function photoKeyPrefix(userId: string) {
  return `uploads/${userId}/`;
}

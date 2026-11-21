import type { UploadTarget } from '@puzzle-log/shared';

export interface PhotoStorage {
  /** Create a short-lived upload the client sends straight to storage. */
  createUpload(contentType: string): Promise<UploadTarget>;
  /** Short-lived URL for viewing a stored photo. */
  getViewUrl(key: string): Promise<string>;
}

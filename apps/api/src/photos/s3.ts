import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_UPLOAD_BYTES } from '@puzzle-log/shared';
import { photoKeyPrefix, type PhotoStorage } from './types.js';

const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const VIEW_EXPIRY_SECONDS = 60 * 60;

/**
 * Photos never pass through the API: clients upload straight to a private bucket with
 * a presigned POST, which (unlike a presigned PUT) lets S3 enforce size and type limits.
 */
export class S3PhotoStorage implements PhotoStorage {
  constructor(
    private readonly bucket: string,
    private readonly client = new S3Client({}),
  ) {}

  async createUpload(userId: string, contentType: string) {
    const key = `${photoKeyPrefix(userId)}${randomUUID()}`;
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', 1, MAX_UPLOAD_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Expires: UPLOAD_EXPIRY_SECONDS,
    });
    return { key, url, fields };
  }

  getViewUrl(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: VIEW_EXPIRY_SECONDS,
    });
  }

  async read(key: string) {
    const { Body, ContentType } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!Body) throw new Error(`Photo ${key} is empty`);
    return { bytes: await Body.transformToByteArray(), contentType: ContentType ?? 'image/jpeg' };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

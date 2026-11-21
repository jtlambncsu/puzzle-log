import type { AppDeps } from './app.js';
import { S3PhotoStorage } from './photos/s3.js';
import { DynamoPuzzleStore } from './stores/dynamo.js';

/**
 * Builds the app's dependencies from environment variables. In AWS, the CDK stack sets
 * these. Locally they are usually unset, so the in-memory store is used and uploads are off.
 */
export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AppDeps {
  return {
    store: env.PUZZLES_TABLE ? new DynamoPuzzleStore(env.PUZZLES_TABLE) : undefined,
    photos: env.PHOTOS_BUCKET ? new S3PhotoStorage(env.PHOTOS_BUCKET) : undefined,
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : undefined,
  };
}

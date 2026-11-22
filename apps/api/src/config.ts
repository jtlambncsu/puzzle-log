import type { AppDeps } from './app.js';
import { S3PhotoStorage } from './photos/s3.js';
import { DynamoPuzzleStore } from './stores/dynamo.js';
import { DynamoBarcodeCache } from './barcodes/cache.js';
import { apiKeyFromSsm, ClaudeSuggester } from './suggestions/claude.js';

function suggesterFromEnv(env: NodeJS.ProcessEnv) {
  // In AWS the key is in SSM Parameter Store; locally it can be an environment variable.
  if (env.ANTHROPIC_KEY_PARAMETER) {
    return new ClaudeSuggester(apiKeyFromSsm(env.ANTHROPIC_KEY_PARAMETER));
  }
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new ClaudeSuggester(async () => apiKey) : undefined;
}

/**
 * Builds the app's dependencies from environment variables. In AWS, the CDK stack sets
 * these. Locally they are usually unset, so the in-memory store is used and uploads are off.
 */
export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): Omit<AppDeps, 'resolveUser'> {
  return {
    store: env.PUZZLES_TABLE ? new DynamoPuzzleStore(env.PUZZLES_TABLE) : undefined,
    photos: env.PHOTOS_BUCKET ? new S3PhotoStorage(env.PHOTOS_BUCKET) : undefined,
    barcodeCache: env.BARCODE_TABLE ? new DynamoBarcodeCache(env.BARCODE_TABLE) : undefined,
    suggester: suggesterFromEnv(env),
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : undefined,
  };
}

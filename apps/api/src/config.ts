import type { AppDeps } from './app.js';
import { S3PhotoStorage } from './photos/s3.js';
import { DynamoPuzzleStore } from './stores/dynamo.js';
import { DynamoBarcodeCache } from './barcodes/cache.js';
import { AnthropicClientProvider, apiKeyFromSsm } from './anthropic.js';
import { ClaudeDetailsFinder } from './details/claude.js';
import { DynamoDetailsJobStore } from './details/jobStores.js';
import { ClaudeSuggester } from './suggestions/claude.js';

/** One Anthropic client, shared by the AI features, or none if no key is configured. */
function anthropicFromEnv(env: NodeJS.ProcessEnv) {
  // In AWS the key is in SSM Parameter Store; locally it can be an environment variable.
  if (env.ANTHROPIC_KEY_PARAMETER) {
    return new AnthropicClientProvider(apiKeyFromSsm(env.ANTHROPIC_KEY_PARAMETER));
  }
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new AnthropicClientProvider(async () => apiKey) : undefined;
}

/**
 * Builds the app's dependencies from environment variables. In AWS, the CDK stack sets
 * these. Locally they are usually unset, so the in-memory store is used and uploads are off.
 */
export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): Omit<AppDeps, 'resolveUser'> {
  const anthropic = anthropicFromEnv(env);
  return {
    store: env.PUZZLES_TABLE ? new DynamoPuzzleStore(env.PUZZLES_TABLE) : undefined,
    photos: env.PHOTOS_BUCKET ? new S3PhotoStorage(env.PHOTOS_BUCKET) : undefined,
    barcodeCache: env.BARCODE_TABLE ? new DynamoBarcodeCache(env.BARCODE_TABLE) : undefined,
    suggester: anthropic && new ClaudeSuggester(anthropic),
    detailsFinder: anthropic && new ClaudeDetailsFinder(anthropic),
    detailsJobs: env.DETAILS_JOBS_TABLE
      ? new DynamoDetailsJobStore(env.DETAILS_JOBS_TABLE)
      : undefined,
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : undefined,
  };
}

import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * One Anthropic client per Lambda instance, created on first use (so a cold start doesn't
 * wait for SSM), and dropped after a 401 so a replaced key is picked up without waiting
 * for AWS to start a fresh instance.
 */
export class AnthropicClientProvider {
  private client?: Promise<Anthropic>;

  /**
   * @param getApiKey Loads the key (e.g. from SSM).
   * @param clientOptions SDK options; tests pass a fake `fetch`.
   */
  constructor(
    private readonly getApiKey: () => Promise<string>,
    private readonly clientOptions: ClientOptions = {},
  ) {}

  get(): Promise<Anthropic> {
    this.client ??= this.getApiKey().then(
      // API Gateway gives up after 30 seconds, so one 25-second try, no retries.
      (apiKey) => new Anthropic({ timeout: 25_000, maxRetries: 0, ...this.clientOptions, apiKey }),
    );
    // Don't cache a failure (e.g. the key wasn't set up yet): try again next time.
    this.client.catch(() => (this.client = undefined));
    return this.client;
  }

  /** Call with any error from a request: a rejected key is loaded again next time. */
  noteError(error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) this.client = undefined;
  }
}

/** Reads the API key from an SSM SecureString parameter (set up once in the AWS console). */
export function apiKeyFromSsm(parameterName: string, ssm = new SSMClient({})) {
  return async () => {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    );
    // Trimmed: a key pasted on a phone easily picks up a space or line break.
    const apiKey = Parameter?.Value?.trim();
    if (!apiKey) throw new Error(`Parameter ${parameterName} is empty`);
    return apiKey;
  };
}

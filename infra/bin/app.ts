import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

/** Comma-separated origins allowed to call the API from a browser (your Vercel URL). */
const allowedOrigins = (app.node.tryGetContext('allowedOrigins') ?? process.env.ALLOWED_ORIGINS)
  ?.split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean);

new ApiStack(app, 'PuzzleLogApi', { env, allowedOrigins });

/**
 * One-time setup, deployed from your machine: lets GitHub Actions deploy PuzzleLogApi.
 *   npx cdk deploy PuzzleLogGithubDeploy -c githubRepo=owner/repo
 */
const githubRepo = app.node.tryGetContext('githubRepo') ?? 'jtlambncsu/puzzle-log';
new GithubDeployStack(app, 'PuzzleLogGithubDeploy', {
  env,
  githubRepo,
  existingOidcProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
});

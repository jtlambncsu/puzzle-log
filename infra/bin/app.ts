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

/** Comma-separated web app URLs that login may redirect back to (your Vercel URL). */
const webUrls = (app.node.tryGetContext('webUrls') ?? process.env.WEB_URLS)
  ?.split(',')
  .map((url: string) => url.trim())
  .filter(Boolean);

new ApiStack(app, 'PuzzleLogApi', { env, allowedOrigins, webUrls });

/**
 * One-time setup, deployed from your machine: lets GitHub Actions deploy PuzzleLogApi.
 *   npx cdk deploy PuzzleLogGithubDeploy
 *
 * For a fork, pass -c githubRepo=owner/repo -c githubOwnerId=<id> -c githubRepoId=<id>
 * (IDs from https://api.github.com/repos/<owner>/<repo>: `owner.id` and `id`).
 */
const githubRepo = app.node.tryGetContext('githubRepo');
new GithubDeployStack(app, 'PuzzleLogGithubDeploy', {
  env,
  githubRepo: githubRepo ?? 'jtlambncsu/puzzle-log',
  githubIds: githubRepo
    ? app.node.tryGetContext('githubOwnerId') && {
        owner: Number(app.node.tryGetContext('githubOwnerId')),
        repo: Number(app.node.tryGetContext('githubRepoId')),
      }
    : { owner: 32425340, repo: 1466053692 },
  existingOidcProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
});

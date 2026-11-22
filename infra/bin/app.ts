import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.js';
import { listSetting } from '../lib/config.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

/**
 * Web app URLs that login may redirect back to. Override with a comma-separated
 * `webUrls` context value or the WEB_URLS GitHub variable.
 */
const webUrls = listSetting(
  app.node.tryGetContext('webUrls'),
  process.env.WEB_URLS,
  'https://puzzle-log-one.vercel.app',
);

/**
 * Comma-separated origins allowed to call the API (and load photos) from a browser.
 * Defaults to the web app URLs: only pages that can sign in need the API, and Vercel
 * preview URLs can't sign in (Cognito only redirects to `webUrls`). Local development
 * goes through Vite's proxy, so it needs no entry.
 */
const allowedOrigins = listSetting(
  app.node.tryGetContext('allowedOrigins'),
  process.env.ALLOWED_ORIGINS,
  webUrls?.join(','),
);

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

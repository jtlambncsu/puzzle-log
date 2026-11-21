import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import {
  OidcProviderNative,
  OpenIdConnectPrincipal,
  PolicyStatement,
  Role,
  type IOidcProvider,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GithubDeployStackProps extends StackProps {
  /** `owner/repo` allowed to deploy. */
  githubRepo: string;
  /**
   * Numeric GitHub owner and repository IDs. Repos created after July 15, 2026 put them in
   * the OIDC subject claim (`repo:owner@123/name@456:...`), so the trust policy needs them.
   */
  githubIds?: { owner: number; repo: number };
  /** Pass this if the account already has a token.actions.githubusercontent.com provider. */
  existingOidcProviderArn?: string;
}

/**
 * Lets GitHub Actions deploy without stored AWS keys. GitHub proves which repo and branch
 * a workflow runs from (OIDC), and only workflows on `main` of this repo can use the role.
 *
 * The role can do nothing except assume the CDK bootstrap roles, which `cdk deploy` uses.
 */
export class GithubDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
    super(scope, id, props);

    const issuer = 'token.actions.githubusercontent.com';

    // Accept both the immutable (ID-based) subject and the legacy name-only one, so the
    // role works whichever format GitHub uses for this repo.
    const [owner, repo] = props.githubRepo.split('/');
    const subjects = [`repo:${props.githubRepo}:ref:refs/heads/main`];
    if (props.githubIds) {
      subjects.unshift(
        `repo:${owner}@${props.githubIds.owner}/${repo}@${props.githubIds.repo}:ref:refs/heads/main`,
      );
    }

    const provider: IOidcProvider = props.existingOidcProviderArn
      ? OidcProviderNative.fromOidcProviderArn(this, 'GithubOidc', props.existingOidcProviderArn)
      : new OidcProviderNative(this, 'GithubOidc', {
          url: `https://${issuer}`,
          clientIds: ['sts.amazonaws.com'],
        });

    const role = new Role(this, 'DeployRole', {
      roleName: 'puzzle-log-github-deploy',
      description: `GitHub Actions deploys for ${props.githubRepo}`,
      assumedBy: new OpenIdConnectPrincipal(provider, {
        StringEquals: {
          [`${issuer}:aud`]: 'sts.amazonaws.com',
          [`${issuer}:sub`]: subjects,
        },
      }),
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description: 'Save as the AWS_DEPLOY_ROLE_ARN variable in GitHub',
    });
  }
}

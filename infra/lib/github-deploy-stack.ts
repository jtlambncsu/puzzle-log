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
          [`${issuer}:sub`]: `repo:${props.githubRepo}:ref:refs/heads/main`,
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

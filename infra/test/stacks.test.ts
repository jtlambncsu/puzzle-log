import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

describe('ApiStack', () => {
  const template = Template.fromStack(
    new ApiStack(new App(), 'Test', { allowedOrigins: ['https://puzzles.example'] }),
  );

  it('keeps data and photos if the stack is deleted', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', { DeletionPolicy: 'Retain' });
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('keeps the photo bucket private', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('passes resource names and allowed origins to the Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PUZZLES_TABLE: Match.anyValue(),
          PHOTOS_BUCKET: Match.anyValue(),
          ALLOWED_ORIGINS: 'https://puzzles.example',
        }),
      },
    });
  });

  it('throttles the API', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: Match.objectLike({ ThrottlingRateLimit: 10 }),
    });
  });
});

describe('GithubDeployStack', () => {
  const template = Template.fromStack(
    new GithubDeployStack(new App(), 'Deploy', { githubRepo: 'me/puzzle-log' }),
  );

  it('only trusts the main branch of the repo', () => {
    const roles = template.findResources('AWS::IAM::Role');
    const trust = JSON.stringify(Object.values(roles)[0]?.Properties.AssumeRolePolicyDocument);
    expect(trust).toContain('repo:me/puzzle-log:ref:refs/heads/main');
  });

  it('can only assume the CDK bootstrap roles', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [Match.objectLike({ Action: 'sts:AssumeRole', Effect: 'Allow' })],
      },
    });
  });
});

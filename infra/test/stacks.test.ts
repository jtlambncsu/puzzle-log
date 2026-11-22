import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';

describe('ApiStack', () => {
  const template = Template.fromStack(
    new ApiStack(new App(), 'Test', {
      allowedOrigins: ['https://puzzles.example'],
      webUrls: ['https://puzzles.example/'],
    }),
  );

  it('requires a Cognito token on every route except the health check', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$default',
      AuthorizationType: 'JWT',
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /api/health',
      AuthorizationType: 'NONE',
    });
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 3);
  });

  it('lets CORS preflights through without a token', () => {
    // A preflight rejected with 401 makes the browser block the real request.
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'OPTIONS /{proxy+}',
      AuthorizationType: 'NONE',
    });
  });

  it('allows every HTTP method the web app uses in CORS', () => {
    // Keep in sync with apps/web/src/api/client.ts.
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowMethods: Match.arrayWith(['GET', 'POST', 'PATCH', 'DELETE']),
      }),
    });
  });

  it('adds CORS headers for the allowed origins', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: ['https://puzzles.example'],
        AllowHeaders: ['authorization', 'content-type'],
      }),
    });
  });

  it('only lets admins create users', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
  });

  it('uses the code flow and only redirects to known web URLs', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      CallbackURLs: ['https://puzzles.example', 'http://localhost:5173'],
      GenerateSecret: false,
    });
  });

  it('caches barcode lookups in a table that expires entries', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      KeySchema: [{ AttributeName: 'barcode', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: { Variables: Match.objectLike({ BARCODE_TABLE: Match.anyValue() }) },
    });
  });

  it('keys puzzles by user', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
    });
  });

  it('keeps data, photos and users if the stack is deleted', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', { DeletionPolicy: 'Retain' });
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
    template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Retain' });
  });

  it('lets the web app upload and download photos, and the API delete them', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          Match.objectLike({
            AllowedMethods: ['POST', 'GET'],
            AllowedOrigins: ['https://puzzles.example'],
          }),
        ],
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 's3:DeleteObject*', Effect: 'Allow' }),
        ]),
      },
    });
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

  it('lets the Lambda read the Anthropic key, and wait long enough for Claude', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 29,
      Environment: {
        Variables: Match.objectLike({ ANTHROPIC_KEY_PARAMETER: '/puzzle-log/anthropic-api-key' }),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['ssm:GetParameter']),
            Resource: Match.objectLike({
              'Fn::Join': Match.arrayWith([
                Match.arrayWith([
                  Match.stringLikeRegexp(':parameter/puzzle-log/anthropic-api-key'),
                ]),
              ]),
            }),
          }),
        ]),
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
    new GithubDeployStack(new App(), 'Deploy', {
      githubRepo: 'me/puzzle-log',
      githubIds: { owner: 11, repo: 22 },
    }),
  );

  it('only trusts the main branch of the repo, in both subject formats', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub': [
                  'repo:me@11/puzzle-log@22:ref:refs/heads/main',
                  'repo:me/puzzle-log:ref:refs/heads/main',
                ],
              },
            },
          }),
        ],
      },
    });
  });

  it('can only assume the CDK bootstrap roles', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [Match.objectLike({ Action: 'sts:AssumeRole', Effect: 'Allow' })],
      },
    });
  });
});

import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpNoneAuthorizer,
  HttpStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { Auth } from './auth.js';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

export interface ApiStackProps extends StackProps {
  /** Browser origins allowed to call the API and upload photos. Omit to allow any. */
  allowedOrigins?: string[];
  /** Web app URLs that login may redirect back to (your Vercel production URL). */
  webUrls?: string[];
}

/**
 * Cognito + DynamoDB + S3 + Lambda running the Express API, behind an API Gateway HTTP API
 * that requires a valid Cognito access token on every route except the health check.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    const origins = props.allowedOrigins?.length ? props.allowedOrigins : ['*'];

    const auth = new Auth(this, 'Auth', { webUrls: props.webUrls ?? [] });

    // RETAIN: deleting the stack must never delete your puzzle history or photos.
    // Keyed by user so each user's puzzles are one partition. (This replaced an earlier
    // `Puzzles` table keyed by id alone, which CloudFormation left behind when removed.)
    const table = new TableV2(this, 'PuzzlesByUser', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'id', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Cached barcode → product lookups. Disposable (it refills from the lookup service), so
    // unlike the puzzles table it's deleted with the stack. `expiresAt` lets DynamoDB expire
    // old entries by itself.
    const barcodeLookups = new TableV2(this, 'BarcodeLookups', {
      partitionKey: { name: 'barcode', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const photos = new Bucket(this, 'Photos', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // Browsers upload with a presigned POST, and download photos with fetch() to edit them
      // (e.g. rotate), both of which need CORS. <img> tags and native mobile apps don't.
      cors: [
        {
          allowedMethods: [HttpMethods.POST, HttpMethods.GET],
          allowedOrigins: origins,
          allowedHeaders: ['*'],
        },
      ],
    });

    const fn = new NodejsFunction(this, 'ApiFunction', {
      entry: repoPath('apps/api/src/lambda.ts'),
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        PUZZLES_TABLE: table.tableName,
        PHOTOS_BUCKET: photos.bucketName,
        BARCODE_TABLE: barcodeLookups.tableName,
        ...(props.allowedOrigins?.length && { ALLOWED_ORIGINS: props.allowedOrigins.join(',') }),
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        // Bundle our own AWS SDK instead of relying on the runtime's copy, which may lag
        // behind and lacks some helpers (like presigned POSTs).
        externalModules: [],
      },
      logGroup: new LogGroup(this, 'ApiLogs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    table.grantReadWriteData(fn);
    barcodeLookups.grantReadWriteData(fn);
    photos.grantPut(fn); // signing a presigned POST requires the signer to be allowed to PUT
    photos.grantRead(fn);
    photos.grantDelete(fn); // remove replaced and deleted puzzles' photos

    const integration = new HttpLambdaIntegration('ApiIntegration', fn);

    const api = new HttpApi(this, 'HttpApi', {
      // Every route needs a valid access token from our user pool and web client.
      defaultAuthorizer: new HttpUserPoolAuthorizer('CognitoAuthorizer', auth.userPool, {
        userPoolClients: [auth.client],
      }),
      defaultIntegration: integration,
      // CORS headers API Gateway adds to every response (replacing any the Lambda sends).
      corsPreflight: {
        allowOrigins: origins,
        allowHeaders: ['authorization', 'content-type'],
        // Every method the web app calls. A method missing here makes the browser block
        // the request, even though the API itself supports it.
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        maxAge: Duration.days(1),
      },
      createDefaultStage: false,
    });

    // Browsers send CORS preflights (OPTIONS) without a token. With a `$default` route,
    // API Gateway routes them like any request, so the authorizer would reject them with
    // 401 and the browser would block the real request. Let them through unauthenticated;
    // Express answers them.
    api.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.OPTIONS],
      integration,
      authorizer: new HttpNoneAuthorizer(),
    });

    api.addRoutes({
      path: '/api/health',
      methods: [HttpMethod.GET],
      integration,
      authorizer: new HttpNoneAuthorizer(),
    });

    // The API has no login yet, so throttling caps what a stranger could cost you.
    new HttpStage(this, 'DefaultStage', {
      httpApi: api,
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'Set this as VITE_API_URL in Vercel',
    });
    new CfnOutput(this, 'PhotosBucketName', { value: photos.bucketName });
    new CfnOutput(this, 'PuzzlesTableName', { value: table.tableName });
  }
}

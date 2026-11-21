import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

export interface ApiStackProps extends StackProps {
  /** Browser origins allowed to call the API and upload photos. Omit to allow any. */
  allowedOrigins?: string[];
}

/** DynamoDB + S3 + Lambda running the Express API, behind an API Gateway HTTP API. */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    const origins = props.allowedOrigins?.length ? props.allowedOrigins : ['*'];

    // RETAIN: deleting the stack must never delete your puzzle history or photos.
    const table = new TableV2(this, 'Puzzles', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const photos = new Bucket(this, 'Photos', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // Browsers upload with a presigned POST, which needs CORS. Native mobile apps don't.
      cors: [
        { allowedMethods: [HttpMethods.POST], allowedOrigins: origins, allowedHeaders: ['*'] },
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
    photos.grantPut(fn); // signing a presigned POST requires the signer to be allowed to PUT
    photos.grantRead(fn);

    const api = new HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', fn),
      createDefaultStage: false,
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

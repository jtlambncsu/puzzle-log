import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

declare global {
  namespace Express {
    interface Request {
      /** The raw API Gateway event, set by the Lambda handler. Absent locally. */
      lambdaEvent?: APIGatewayProxyEventV2WithJWTAuthorizer;
    }
    interface Locals {
      /** Set by `requireUser`. */
      userId: string;
    }
  }
}

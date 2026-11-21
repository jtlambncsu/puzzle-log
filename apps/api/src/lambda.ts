import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import serverless from 'serverless-http';
import { createApp } from './app.js';
import { userFromApiGateway } from './auth.js';
import { depsFromEnv } from './config.js';

// Created once per Lambda container and reused across requests.
const app = createApp({ ...depsFromEnv(), resolveUser: userFromApiGateway });

export const handler = serverless(app, {
  // Hand the API Gateway event (with the verified token's claims) to Express.
  request(req: Express.Request, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
    req.lambdaEvent = event;
  },
});

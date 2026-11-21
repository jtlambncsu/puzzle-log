import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, Context } from 'aws-lambda';
import { handler } from './lambda.js';

/** A minimal API Gateway HTTP API (payload v2) event, optionally with verified JWT claims. */
function httpEvent(
  method: string,
  path: string,
  claims?: Record<string, string>,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'api.example.com' },
    isBase64Encoded: false,
    requestContext: {
      accountId: '123',
      apiId: 'api',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'req',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: {
        principalId: '',
        integrationLatency: 0,
        jwt: { claims: claims ?? {}, scopes: [] },
      },
    },
  };
}

type Result = { statusCode: number; body: string };
const invoke = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  (await handler(event, {} as Context)) as Result;

describe('Lambda handler', () => {
  it('serves the Express app through API Gateway events', async () => {
    const res = await invoke(httpEvent('GET', '/api/health'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('identifies the user from the verified token claims', async () => {
    const created = await invoke({
      ...httpEvent('POST', '/api/puzzles', { sub: 'cognito-user-1' }),
      headers: { host: 'api.example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'From Lambda' }),
    });
    expect(created.statusCode).toBe(201);
    expect(JSON.parse(created.body).userId).toBe('cognito-user-1');
  });

  it('rejects requests without token claims', async () => {
    const res = await invoke(httpEvent('GET', '/api/puzzles'));
    expect(res.statusCode).toBe(401);
  });
});

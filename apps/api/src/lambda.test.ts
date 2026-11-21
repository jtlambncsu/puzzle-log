import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { handler } from './lambda.js';

/** A minimal API Gateway HTTP API (payload v2) event. */
function httpEvent(method: string, path: string): APIGatewayProxyEventV2 {
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
    },
  };
}

describe('Lambda handler', () => {
  it('serves the Express app through API Gateway events', async () => {
    const res = (await handler(httpEvent('GET', '/api/health'), {} as Context)) as {
      statusCode: number;
      body: string;
    };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });
});

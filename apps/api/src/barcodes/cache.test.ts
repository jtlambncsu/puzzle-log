import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoBarcodeCache, InMemoryBarcodeCache } from './cache.js';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const dynamo = mockClient(client);

describe('DynamoBarcodeCache', () => {
  beforeEach(() => dynamo.reset());

  it('stores entries with a TTL', async () => {
    vi.setSystemTime(new Date('2026-11-21T00:00:00Z'));
    dynamo.on(PutCommand).resolves({});

    await new DynamoBarcodeCache('Barcodes', client).set('1', { product: { title: 'x' } }, 60);

    expect(dynamo.commandCalls(PutCommand)[0]?.args[0].input.Item).toEqual({
      barcode: '1',
      product: { title: 'x' },
      expiresAt: Date.parse('2026-11-21T00:00:00Z') / 1000 + 60,
    });
    vi.useRealTimers();
  });

  it('ignores expired entries DynamoDB has not deleted yet', async () => {
    dynamo.on(GetCommand).resolves({ Item: { barcode: '1', expiresAt: 1 } });
    expect(await new DynamoBarcodeCache('Barcodes', client).get('1')).toBeUndefined();
  });
});

describe('InMemoryBarcodeCache', () => {
  it('forgets entries after their TTL', async () => {
    const cache = new InMemoryBarcodeCache();
    await cache.set('a', {}, 60);
    await cache.set('b', {}, -1);
    expect(await cache.get('a')).toEqual({ product: undefined });
    expect(await cache.get('b')).toBeUndefined();
  });
});

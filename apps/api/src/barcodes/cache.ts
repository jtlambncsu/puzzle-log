import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { BarcodeCache, CachedLookup } from './types.js';

const now = () => Math.floor(Date.now() / 1000);

export class InMemoryBarcodeCache implements BarcodeCache {
  private entries = new Map<string, CachedLookup & { expiresAt: number }>();

  async get(barcode: string) {
    const entry = this.entries.get(barcode);
    return entry && entry.expiresAt > now() ? { product: entry.product } : undefined;
  }

  async set(barcode: string, entry: CachedLookup, ttlSeconds: number) {
    this.entries.set(barcode, { ...entry, expiresAt: now() + ttlSeconds });
  }
}

/**
 * One item per barcode. `expiresAt` is the table's TTL attribute, so DynamoDB deletes stale
 * entries itself. Deletion can lag, so reads also check it.
 */
export class DynamoBarcodeCache implements BarcodeCache {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async get(barcode: string) {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { barcode } }),
    );
    if (!Item || (Item.expiresAt as number) <= now()) return undefined;
    return { product: Item.product as CachedLookup['product'] };
  }

  async set(barcode: string, entry: CachedLookup, ttlSeconds: number) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { barcode, product: entry.product, expiresAt: now() + ttlSeconds },
      }),
    );
  }
}

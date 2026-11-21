import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoPuzzleStore } from './dynamo.js';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const dynamo = mockClient(client);
const store = new DynamoPuzzleStore('Puzzles', client);

describe('DynamoPuzzleStore', () => {
  beforeEach(() => dynamo.reset());

  it('scans every page and sorts newest first', async () => {
    dynamo
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{ id: 'old', title: 'Old', createdAt: '2026-01-01' }],
        LastEvaluatedKey: { id: 'old' },
      })
      .resolvesOnce({ Items: [{ id: 'new', title: 'New', createdAt: '2026-06-01' }] });

    const puzzles = await store.list();

    expect(puzzles.map((p) => p.id)).toEqual(['new', 'old']);
    expect(dynamo.commandCalls(ScanCommand)).toHaveLength(2);
  });

  it('writes new puzzles to the table', async () => {
    dynamo.on(PutCommand).resolves({});

    const puzzle = await store.create({ title: 'Starry Night' });

    const [call] = dynamo.commandCalls(PutCommand);
    expect(call?.args[0].input).toMatchObject({ TableName: 'Puzzles', Item: puzzle });
  });

  it('reports whether a delete removed anything', async () => {
    dynamo
      .on(DeleteCommand)
      .resolvesOnce({ Attributes: { id: 'a' } })
      .resolvesOnce({});

    expect(await store.delete('a')).toBe(true);
    expect(await store.delete('missing')).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoPuzzleStore } from './dynamo.js';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const dynamo = mockClient(client);
const store = new DynamoPuzzleStore('Puzzles', client);

describe('DynamoPuzzleStore', () => {
  beforeEach(() => dynamo.reset());

  it("queries only the user's partition, every page, newest first", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ id: 'old', userId: 'u1', title: 'Old', createdAt: '2026-01-01' }],
        LastEvaluatedKey: { userId: 'u1', id: 'old' },
      })
      .resolvesOnce({
        Items: [{ id: 'new', userId: 'u1', title: 'New', createdAt: '2026-06-01' }],
      });

    const puzzles = await store.list('u1');

    expect(puzzles.map((p) => p.id)).toEqual(['new', 'old']);
    const calls = dynamo.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0].input.ExpressionAttributeValues).toEqual({ ':userId': 'u1' });
  });

  it('gets by user and id', async () => {
    dynamo.on(GetCommand).resolves({});
    await store.get('u1', 'p1');
    expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input.Key).toEqual({
      userId: 'u1',
      id: 'p1',
    });
  });

  it('writes new puzzles with their owner', async () => {
    dynamo.on(PutCommand).resolves({});

    const puzzle = await store.create('u1', { title: 'Starry Night' });

    expect(puzzle.userId).toBe('u1');
    const [call] = dynamo.commandCalls(PutCommand);
    expect(call?.args[0].input).toMatchObject({ TableName: 'Puzzles', Item: puzzle });
  });

  it('reports whether a delete removed anything', async () => {
    dynamo
      .on(DeleteCommand)
      .resolvesOnce({ Attributes: { id: 'a' } })
      .resolvesOnce({});

    expect(await store.delete('u1', 'a')).toBe(true);
    expect(await store.delete('u1', 'missing')).toBe(false);
    expect(dynamo.commandCalls(DeleteCommand)[0]?.args[0].input.Key).toEqual({
      userId: 'u1',
      id: 'a',
    });
  });
});

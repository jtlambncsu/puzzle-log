import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
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

  it('updates only the given fields of an existing item', async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: { id: 'p1', title: 'New' } });

    const updated = await store.update('u1', 'p1', { title: 'New', imageKey: 'uploads/u1/k' });

    expect(updated).toMatchObject({ title: 'New' });
    expect(dynamo.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
      Key: { userId: 'u1', id: 'p1' },
      UpdateExpression: 'SET #title = :title, #imageKey = :imageKey',
      ExpressionAttributeValues: { ':title': 'New', ':imageKey': 'uploads/u1/k' },
      ConditionExpression: 'attribute_exists(id)',
    });
  });

  it('removes fields set to null, and can only remove', async () => {
    dynamo.on(UpdateCommand).resolves({ Attributes: { id: 'p1' } });

    await store.update('u1', 'p1', { brand: null, tags: ['Star Wars'] });
    await store.update('u1', 'p1', { notes: null });

    const [mixed, removeOnly] = dynamo
      .commandCalls(UpdateCommand)
      .map((call) => call.args[0].input);
    expect(mixed).toMatchObject({
      UpdateExpression: 'SET #tags = :tags REMOVE #brand',
      ExpressionAttributeNames: { '#brand': 'brand', '#tags': 'tags' },
      ExpressionAttributeValues: { ':tags': ['Star Wars'] },
    });
    expect(removeOnly?.UpdateExpression).toBe('REMOVE #notes');
    expect(removeOnly).not.toHaveProperty('ExpressionAttributeValues');
  });

  it("returns undefined when updating an item that doesn't exist", async () => {
    dynamo
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'nope', $metadata: {} }));
    expect(await store.update('u1', 'missing', { title: 'x' })).toBeUndefined();
  });

  it('returns what a delete removed', async () => {
    dynamo
      .on(DeleteCommand)
      .resolvesOnce({ Attributes: { id: 'a' } })
      .resolvesOnce({});

    expect(await store.delete('u1', 'a')).toMatchObject({ id: 'a' });
    expect(await store.delete('u1', 'missing')).toBeUndefined();
    expect(dynamo.commandCalls(DeleteCommand)[0]?.args[0].input.Key).toEqual({
      userId: 'u1',
      id: 'a',
    });
  });
});

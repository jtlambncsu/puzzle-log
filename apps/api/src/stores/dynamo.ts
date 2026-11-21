import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import { newestFirst, newPuzzle, type PuzzleStore } from './types.js';

/**
 * Table keyed by `userId` (partition) and `id` (sort), so listing a user's puzzles is a
 * single Query, and one user's requests can never touch another user's items.
 */
export class DynamoPuzzleStore implements PuzzleStore {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async list(userId: string) {
    const items: Puzzle[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ExclusiveStartKey: startKey,
        }),
      );
      items.push(...((page.Items ?? []) as Puzzle[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items.sort(newestFirst);
  }

  async get(userId: string, id: string) {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { userId, id } }),
    );
    return Item as Puzzle | undefined;
  }

  async create(userId: string, input: CreatePuzzleInput) {
    const puzzle = newPuzzle(userId, input, randomUUID());
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: puzzle,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return puzzle;
  }

  async delete(userId: string, id: string) {
    const { Attributes } = await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { userId, id },
        ReturnValues: 'ALL_OLD',
      }),
    );
    return Attributes !== undefined;
  }
}

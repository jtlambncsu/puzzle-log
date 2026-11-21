import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CreatePuzzleInput, Puzzle, UpdatePuzzleInput } from '@puzzle-log/shared';
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

  async update(userId: string, id: string, patch: UpdatePuzzleInput) {
    // Build "SET #title = :title, ..." from the patch. Names and values go through
    // placeholders, so field names that are reserved words in DynamoDB are safe.
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    try {
      const { Attributes } = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId, id },
          UpdateExpression: `SET ${entries.map(([name]) => `#${name} = :${name}`).join(', ')}`,
          ExpressionAttributeNames: Object.fromEntries(entries.map(([name]) => [`#${name}`, name])),
          ExpressionAttributeValues: Object.fromEntries(
            entries.map(([name, value]) => [`:${name}`, value]),
          ),
          // Without this, UpdateItem would create a new item for an unknown id.
          ConditionExpression: 'attribute_exists(id)',
          ReturnValues: 'ALL_NEW',
        }),
      );
      return Attributes as Puzzle;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return undefined;
      throw error;
    }
  }

  async delete(userId: string, id: string) {
    const { Attributes } = await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { userId, id },
        ReturnValues: 'ALL_OLD',
      }),
    );
    return Attributes as Puzzle | undefined;
  }
}

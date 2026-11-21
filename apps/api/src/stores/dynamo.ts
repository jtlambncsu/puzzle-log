import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import { newestFirst, newPuzzle, type PuzzleStore } from './types.js';

/**
 * One item per puzzle, keyed by `id`. `list` scans the whole table, which is fine
 * for a personal log. With many users you would add a userId partition key and query.
 */
export class DynamoPuzzleStore implements PuzzleStore {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async list() {
    const items: Puzzle[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: startKey }),
      );
      items.push(...((page.Items ?? []) as Puzzle[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return items.sort(newestFirst);
  }

  async get(id: string) {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return Item as Puzzle | undefined;
  }

  async create(input: CreatePuzzleInput) {
    const puzzle = newPuzzle(input, randomUUID());
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: puzzle,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return puzzle;
  }

  async delete(id: string) {
    const { Attributes } = await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id }, ReturnValues: 'ALL_OLD' }),
    );
    return Attributes !== undefined;
  }
}

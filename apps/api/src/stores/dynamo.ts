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
import type { CreatePuzzleInput, Puzzle } from '@puzzle-log/shared';
import {
  ConflictError,
  newestFirst,
  newPuzzle,
  type PuzzlePatch,
  type PuzzleStore,
  type TimerExpectation,
} from './types.js';

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

  async update(userId: string, id: string, patch: PuzzlePatch, expect?: TimerExpectation) {
    // JSON Merge Patch: values are SET, nulls are REMOVEd, omitted fields are untouched.
    // Names and values go through placeholders, so reserved words in DynamoDB are safe.
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    const toSet = entries.filter(([, value]) => value !== null);
    const toRemove = entries.filter(([, value]) => value === null);
    const clauses = [
      toSet.length && `SET ${toSet.map(([name]) => `#${name} = :${name}`).join(', ')}`,
      toRemove.length && `REMOVE ${toRemove.map(([name]) => `#${name}`).join(', ')}`,
    ].filter(Boolean);

    const names = Object.fromEntries(entries.map(([name]) => [`#${name}`, name]));
    const values = Object.fromEntries(toSet.map(([name, value]) => [`:${name}`, value]));
    // Without attribute_exists, UpdateItem would create a new item for an unknown id.
    let condition = 'attribute_exists(id)';
    if (expect) {
      // Optimistic concurrency: only write if nobody started or stopped the timer since the
      // caller read the puzzle, so a double tap can't record the same session twice.
      names['#timerStartedAt'] = 'timerStartedAt';
      if (expect.timerStartedAt === null) {
        condition += ' AND attribute_not_exists(#timerStartedAt)';
      } else {
        condition += ' AND #timerStartedAt = :expectedTimerStartedAt';
        values[':expectedTimerStartedAt'] = expect.timerStartedAt;
      }
    }

    try {
      const { Attributes } = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId, id },
          UpdateExpression: clauses.join(' '),
          ExpressionAttributeNames: names,
          // DynamoDB rejects an empty values map, e.g. when only removing fields.
          ...(Object.keys(values).length && { ExpressionAttributeValues: values }),
          ConditionExpression: condition,
          ReturnValues: 'ALL_NEW',
          // On a failed condition, the error carries the item, telling "missing" from "changed".
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        }),
      );
      return Attributes as Puzzle;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        if (error.Item) throw new ConflictError();
        return undefined;
      }
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

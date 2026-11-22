import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DetailsJob } from '@puzzle-log/shared';
import type { DetailsJobStore } from './types.js';

const newestFirst = (a: DetailsJob, b: DetailsJob) => b.createdAt.localeCompare(a.createdAt);

/** For local development and tests. */
export class InMemoryDetailsJobStore implements DetailsJobStore {
  private jobs = new Map<string, DetailsJob>();

  async list(userId: string) {
    return [...this.jobs.values()].filter((job) => job.userId === userId).sort(newestFirst);
  }

  async put(job: DetailsJob) {
    this.jobs.set(job.id, structuredClone(job));
  }
}

/** Table keyed by `userId` (partition) and `id` (sort), like the puzzles table. */
export class DynamoDetailsJobStore implements DetailsJobStore {
  constructor(
    private readonly tableName: string,
    private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}

  async list(userId: string) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      }),
    );
    return (Items as DetailsJob[]).sort(newestFirst);
  }

  async put(job: DetailsJob) {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: job }));
  }
}

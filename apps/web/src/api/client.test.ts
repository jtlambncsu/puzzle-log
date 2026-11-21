import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPuzzlesApi } from './client';

function mockFetch(status = 200, body: unknown = []) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createPuzzlesApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the access token as a bearer token', async () => {
    const fetchMock = mockFetch();
    await createPuzzlesApi(async () => 'token-123').list();
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({
      Authorization: 'Bearer token-123',
    });
  });

  it('sends no Authorization header when auth is off', async () => {
    const fetchMock = mockFetch();
    await createPuzzlesApi(async () => undefined).list();
    expect(fetchMock.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  });

  it('explains a 401 as an expired session', async () => {
    mockFetch(401, { error: 'Unauthorized' });
    await expect(createPuzzlesApi(async () => 'old').list()).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/sign in again/i),
    });
  });
});

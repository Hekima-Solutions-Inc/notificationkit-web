import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationKitHttp } from '../../src/core/http';
import { NotificationKitError } from '../../src/core/errors';

const BASE_URL = 'https://example.supabase.co';
const API_KEY = 'test-api-key-123';

function makeOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function makeErrorResponse(status: number, text: string) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: vi.fn(),
    text: vi.fn().mockResolvedValue(text),
  } as unknown as Response;
}

describe('NotificationKitHttp', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('POST', () => {
    it('sends correct URL, headers, and JSON body', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeOkResponse({ success: true }));

      await http.post('sdk-identify', { app_user_id: 'user1', platform: 'web' });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/functions/v1/sdk-identify`);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['x-api-key']).toBe(API_KEY);
      expect(JSON.parse(options.body)).toEqual({ app_user_id: 'user1', platform: 'web' });
    });

    it('returns parsed JSON on success', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      const responseData = { app_user_id: 'nk-123', subscription_id: null, tags: {} };
      fetchMock.mockResolvedValue(makeOkResponse(responseData));

      const result = await http.post('sdk-identify', { app_user_id: 'user1' });
      expect(result).toEqual(responseData);
    });

    it('throws NotificationKitError on non-ok response with status and message', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'));

      await expect(http.post('sdk-identify', {})).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof NotificationKitError &&
          err.status === 401 &&
          err.message === 'Unauthorized'
        );
      });
    });

    it('falls back to statusText when response body is empty', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeErrorResponse(500, ''));

      await expect(http.post('sdk-identify', {})).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof NotificationKitError &&
          err.status === 500 &&
          err.message === 'Error'
        );
      });
    });

    it('returns null without calling fetch when canSend returns false', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => false);

      const result = await http.post('sdk-identify', { app_user_id: 'user1' });

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('makes the fetch call normally when canSend returns true', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await http.post('sdk-identify', { app_user_id: 'user1' });

      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe('GET', () => {
    it('sends correct URL with query params and x-api-key header', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeOkResponse([]));

      await http.get('sdk-in-app', { app_user_id: 'user1', limit: '10' });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(`${BASE_URL}/functions/v1/sdk-in-app`);
      expect(parsed.searchParams.get('app_user_id')).toBe('user1');
      expect(parsed.searchParams.get('limit')).toBe('10');
      expect(options.headers['x-api-key']).toBe(API_KEY);
      // GET should not set Content-Type
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('sends correct URL with no query params when params is omitted', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await http.get('sdk-in-app');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/functions/v1/sdk-in-app`);
    });

    it('throws NotificationKitError on non-ok response', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeErrorResponse(403, 'Forbidden'));

      await expect(http.get('sdk-in-app', { app_user_id: 'user1' })).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof NotificationKitError &&
          err.status === 403 &&
          err.message === 'Forbidden'
        );
      });
    });

    it('returns null without calling fetch when canSend returns false', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => false);

      const result = await http.get('sdk-in-app', { app_user_id: 'user1' });

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('makes the fetch call normally when canSend returns true', async () => {
      const http = new NotificationKitHttp(API_KEY, BASE_URL, () => true);
      fetchMock.mockResolvedValue(makeOkResponse([]));

      await http.get('sdk-in-app');

      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});

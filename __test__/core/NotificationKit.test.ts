import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationKit } from '../../src/core/NotificationKit';
import { NotificationKitError } from '../../src/core/errors';
import { storage } from '../../src/utils/storage';

// Helper: reset the NotificationKit singleton between tests
// TypeScript private is compile-time only — cast to any to reach private static fields
function resetNotificationKit() {
  const NK = NotificationKit as unknown as Record<string, unknown>;
  NK['_config'] = null;
  NK['_http'] = null;
  NK['_userId'] = null;
  NK['_nkUserId'] = null;
  NK['_consentRequired'] = false;
  NK['_consentGiven'] = false;
  NK['_initialized'] = false;
  // Close and clear broadcast channel
  const ch = NK['_channel'] as { close?: () => void } | null;
  if (ch && typeof ch.close === 'function') ch.close();
  NK['_channel'] = null;
}

const INIT_OPTIONS = {
  apiKey: 'test-key',
  baseUrl: 'https://test.supabase.co',
};

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

// Default successful login response
const LOGIN_RESPONSE = {
  app_user_id: 'nk-user-abc',
  subscription_id: null,
  tags: { plan: 'pro' },
};

describe('NotificationKit', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset singleton state before each test
    resetNotificationKit();

    // Mock fetch
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    // Mock BroadcastChannel
    const mockBroadcastChannel = vi.fn().mockImplementation(() => ({
      onmessage: null,
      postMessage: vi.fn(),
      close: vi.fn(),
    }));
    vi.stubGlobal('BroadcastChannel', mockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetNotificationKit();
  });

  // ─── init() ────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('sets up config and namespaces after init', () => {
      NotificationKit.init(INIT_OPTIONS);

      expect(NotificationKit.User).toBeDefined();
      expect(NotificationKit.Session).toBeDefined();
      expect(NotificationKit.Notifications).toBeDefined();
      expect(NotificationKit.InAppMessages).toBeDefined();
      expect(NotificationKit.Debug).toBeDefined();
    });

    it('is idempotent — calling init twice does nothing on the second call', () => {
      NotificationKit.init(INIT_OPTIONS);
      // Second init with different key should be ignored
      NotificationKit.init({ apiKey: 'different-key', baseUrl: 'https://other.supabase.co' });

      // The http instance should still use the first apiKey
      const NK = NotificationKit as unknown as Record<string, unknown>;
      const http = NK['_http'] as Record<string, unknown>;
      expect(http['_apiKey']).toBe('test-key');
    });

    it('registers the service worker during init', () => {
      NotificationKit.init(INIT_OPTIONS);
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/NotificationKitWorker.js');
    });
  });

  // ─── Before init ───────────────────────────────────────────────────────────

  describe('before init', () => {
    it('login() throws NotificationKitError', async () => {
      await expect(NotificationKit.login('user1')).rejects.toBeInstanceOf(NotificationKitError);
    });

    it('identify() throws NotificationKitError', async () => {
      await expect(NotificationKit.identify({ email: 'a@b.com' })).rejects.toBeInstanceOf(NotificationKitError);
    });

    it('track() throws NotificationKitError', async () => {
      await expect(NotificationKit.track('page_view')).rejects.toBeInstanceOf(NotificationKitError);
    });

    it('logout() throws NotificationKitError', async () => {
      await expect(NotificationKit.logout()).rejects.toBeInstanceOf(NotificationKitError);
    });
  });

  // ─── login() ───────────────────────────────────────────────────────────────

  describe('login()', () => {
    beforeEach(() => {
      NotificationKit.init(INIT_OPTIONS);
    });

    it('calls sdk-identify with correct payload', async () => {
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));

      await NotificationKit.login('user1');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('sdk-identify');
      const body = JSON.parse(options.body);
      expect(body.app_user_id).toBe('user1');
      expect(body.platform).toBe('web');
      expect(typeof body.timezone).toBe('string');
    });

    it('persists userId and nkUserId after successful login', async () => {
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));

      await NotificationKit.login('user1');

      expect(NotificationKit.userId).toBe('user1');
      expect(NotificationKit.nkUserId).toBe('nk-user-abc');
      // Check localStorage persistence
      expect(storage.get('userId')).toBe('user1');
      expect(storage.get('nkUserId')).toBe('nk-user-abc');
    });

    it('returns nkUserId when login response is received', async () => {
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));

      const result = await NotificationKit.login('user1');

      expect(result).toBe('nk-user-abc');
    });

    it('returns userId as fallback when response is null (consent blocked)', async () => {
      NotificationKit.setConsentRequired(true);
      // consent not given — http.post returns null

      const result = await NotificationKit.login('user1');

      expect(result).toBe('user1');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── identify() ────────────────────────────────────────────────────────────

  describe('identify()', () => {
    beforeEach(async () => {
      NotificationKit.init(INIT_OPTIONS);
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));
      await NotificationKit.login('user1');
      fetchMock.mockClear();
    });

    it('calls sdk-identify with mapped fields (firstName -> first_name)', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.identify({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        language: 'en',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('sdk-identify');
      const body = JSON.parse(options.body);
      expect(body.app_user_id).toBe('user1');
      expect(body.email).toBe('user@example.com');
      expect(body.first_name).toBe('John');
      expect(body.last_name).toBe('Doe');
      expect(body.language).toBe('en');
    });

    it('includes custom attributes in body', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.identify({
        attributes: { custom_field: 'hello', score: 42 },
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.custom_field).toBe('hello');
      expect(body.score).toBe(42);
    });

    it('does not include reserved keys from attributes', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.identify({
        attributes: { platform: 'ios', email: 'override@test.com', safe_key: 'ok' },
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // 'platform' and 'email' are reserved, should be excluded from attributes merge
      expect(body.platform).toBeUndefined();
      expect(body.safe_key).toBe('ok');
    });

    it('throws NotificationKitError if not logged in', async () => {
      // Reset state, clear storage, and re-init without logging in
      resetNotificationKit();
      localStorage.clear();
      NotificationKit.init(INIT_OPTIONS);

      await expect(
        NotificationKit.identify({ email: 'a@b.com' })
      ).rejects.toBeInstanceOf(NotificationKitError);
    });
  });

  // ─── track() ───────────────────────────────────────────────────────────────

  describe('track()', () => {
    beforeEach(async () => {
      NotificationKit.init(INIT_OPTIONS);
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));
      await NotificationKit.login('user1');
      fetchMock.mockClear();
    });

    it('calls sdk-track with app_user_id, event, and properties', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.track('purchase', { item: 'widget', amount: 9.99 });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('sdk-track');
      const body = JSON.parse(options.body);
      expect(body.app_user_id).toBe('user1');
      expect(body.event).toBe('purchase');
      expect(body.properties).toEqual({ item: 'widget', amount: 9.99 });
    });

    it('calls sdk-track without properties when not provided', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.track('page_view');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.event).toBe('page_view');
      expect(body.properties).toBeUndefined();
    });

    it('throws NotificationKitError if not logged in', async () => {
      resetNotificationKit();
      localStorage.clear();
      NotificationKit.init(INIT_OPTIONS);

      await expect(NotificationKit.track('page_view')).rejects.toBeInstanceOf(NotificationKitError);
    });
  });

  // ─── logout() ──────────────────────────────────────────────────────────────

  describe('logout()', () => {
    beforeEach(async () => {
      NotificationKit.init(INIT_OPTIONS);
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));
      await NotificationKit.login('user1');
      fetchMock.mockClear();
    });

    it('calls sdk-logout with app_user_id', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.logout();

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('sdk-logout');
      const body = JSON.parse(options.body);
      expect(body.app_user_id).toBe('user1');
    });

    it('clears userId, nkUserId, and localStorage after logout', async () => {
      fetchMock.mockResolvedValue(makeOkResponse({}));

      await NotificationKit.logout();

      expect(NotificationKit.userId).toBeNull();
      expect(NotificationKit.nkUserId).toBeNull();
      expect(storage.get('userId')).toBeNull();
      expect(storage.get('nkUserId')).toBeNull();
    });

    it('does not throw if sdk-logout API call fails (fire-and-forget)', async () => {
      fetchMock.mockResolvedValue(makeErrorResponse(500, 'Server error'));

      // Should not throw
      await expect(NotificationKit.logout()).resolves.toBeUndefined();

      // State should still be cleared
      expect(NotificationKit.userId).toBeNull();
    });
  });

  // ─── Consent ───────────────────────────────────────────────────────────────

  describe('consent gate', () => {
    it('setConsentRequired(true) blocks API calls until setConsentGiven(true)', async () => {
      NotificationKit.init({ ...INIT_OPTIONS, requireConsent: true });

      // Without consent, login POST should be blocked (returns null, no fetch)
      await NotificationKit.login('user1');
      expect(fetchMock).not.toHaveBeenCalled();

      // Grant consent
      NotificationKit.setConsentGiven(true);

      // Now fetch should be called
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));
      await NotificationKit.login('user1');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('setConsentRequired(false) allows API calls immediately', async () => {
      NotificationKit.init({ ...INIT_OPTIONS, requireConsent: false });
      fetchMock.mockResolvedValue(makeOkResponse(LOGIN_RESPONSE));

      await NotificationKit.login('user1');

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('setConsentGiven persists consent flag to localStorage', () => {
      NotificationKit.init(INIT_OPTIONS);
      NotificationKit.setConsentGiven(true);

      expect(storage.get('consent')).toBe('1');

      NotificationKit.setConsentGiven(false);
      expect(storage.get('consent')).toBe('0');
    });
  });
});

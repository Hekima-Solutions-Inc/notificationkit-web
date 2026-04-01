import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationsNamespace } from '../../src/namespaces/notifications';
import { NotificationKitConfig } from '../../src/core/config';

const mockConfig: NotificationKitConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://example.supabase.co',
  serviceWorkerPath: '/NotificationKitWorker.js',
  requireConsent: false,
};

function makeNotifications() {
  return new NotificationsNamespace(mockConfig);
}

// Helper to temporarily add globals and clean up after
function withGlobals(additions: Record<string, any>, fn: () => void | Promise<void>) {
  const originals: Record<string, any> = {};
  for (const [key, val] of Object.entries(additions)) {
    originals[key] = (globalThis as any)[key];
    (globalThis as any)[key] = val;
  }
  const cleanup = () => {
    for (const [key, orig] of Object.entries(originals)) {
      if (orig === undefined) {
        delete (globalThis as any)[key];
      } else {
        (globalThis as any)[key] = orig;
      }
    }
  };
  const result = fn();
  if (result instanceof Promise) {
    return result.finally(cleanup);
  }
  cleanup();
}

const mockNotification = (permission: NotificationPermission, requestResult: NotificationPermission) => ({
  permission,
  requestPermission: vi.fn().mockResolvedValue(requestResult),
});

describe('NotificationsNamespace', () => {
  describe('permission', () => {
    it('returns Notification.permission when Notification is defined', () => {
      (globalThis as any).Notification = { permission: 'granted', requestPermission: vi.fn() };
      const ns = makeNotifications();
      expect(ns.permission).toBe('granted');
      delete (globalThis as any).Notification;
    });

    it('returns "default" when Notification is undefined', () => {
      const orig = (globalThis as any).Notification;
      delete (globalThis as any).Notification;
      const ns = makeNotifications();
      expect(ns.permission).toBe('default');
      if (orig !== undefined) (globalThis as any).Notification = orig;
    });
  });

  describe('isPushSupported()', () => {
    afterEach(() => {
      // Clean up all APIs added during these tests
      try { delete (navigator as any).serviceWorker; } catch { /* ignore */ }
      delete (window as any).PushManager;
      delete (globalThis as any).Notification;
    });

    it('returns false when serviceWorker is missing from navigator', () => {
      // Ensure serviceWorker is absent (it may have been added by a prior test run)
      try { delete (navigator as any).serviceWorker; } catch { /* ignore */ }
      // Add the other two APIs so serviceWorker is the only missing piece
      (window as any).PushManager = {};
      (globalThis as any).Notification = { permission: 'default', requestPermission: vi.fn() };

      const ns = makeNotifications();
      expect(ns.isPushSupported()).toBe(false);
    });

    it('returns true when serviceWorker, PushManager, and Notification are all present', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
        writable: true,
      });
      (window as any).PushManager = {};
      (globalThis as any).Notification = { permission: 'default', requestPermission: vi.fn() };

      const ns = makeNotifications();
      expect(ns.isPushSupported()).toBe(true);
    });
  });

  describe('requestPermission()', () => {
    it('calls Notification.requestPermission when push is supported', async () => {
      const notifMock = mockNotification('default', 'granted');
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
        writable: true,
      });
      (window as any).PushManager = {};
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      await ns.requestPermission();

      expect(notifMock.requestPermission).toHaveBeenCalledOnce();

      delete (window as any).PushManager;
      delete (globalThis as any).Notification;
    });

    it('fires permissionChange listeners when permission changes', async () => {
      const notifMock = mockNotification('default', 'granted');
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
        writable: true,
      });
      (window as any).PushManager = {};
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      const cb = vi.fn();
      ns.addEventListener('permissionChange', cb);

      await ns.requestPermission();

      expect(cb).toHaveBeenCalledWith('granted');

      delete (window as any).PushManager;
      delete (globalThis as any).Notification;
    });

    it('does not fire permissionChange listeners when permission is unchanged', async () => {
      const notifMock = mockNotification('default', 'default');
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
        writable: true,
      });
      (window as any).PushManager = {};
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      const cb = vi.fn();
      ns.addEventListener('permissionChange', cb);

      await ns.requestPermission();

      expect(cb).not.toHaveBeenCalled();

      delete (window as any).PushManager;
      delete (globalThis as any).Notification;
    });

    it('returns "default" without calling Notification.requestPermission when push not supported', async () => {
      // Remove serviceWorker to make push unsupported
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      delete (window as any).PushManager;
      const notifMock = mockNotification('default', 'granted');
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      const result = await ns.requestPermission();

      delete (globalThis as any).Notification;

      expect(result).toBe('default');
      expect(notifMock.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('addEventListener / removeEventListener (permissionChange)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
        writable: true,
      });
      (window as any).PushManager = {};
    });

    afterEach(() => {
      delete (window as any).PushManager;
      delete (globalThis as any).Notification;
    });

    it('registers and receives permissionChange events', async () => {
      const notifMock = mockNotification('default', 'granted');
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      const cb = vi.fn();
      ns.addEventListener('permissionChange', cb);
      await ns.requestPermission();

      expect(cb).toHaveBeenCalledWith('granted');
    });

    it('stops receiving events after removeEventListener', async () => {
      const notifMock = mockNotification('default', 'granted');
      (globalThis as any).Notification = notifMock;

      const ns = makeNotifications();
      const cb = vi.fn();
      ns.addEventListener('permissionChange', cb);
      ns.removeEventListener('permissionChange', cb);
      await ns.requestPermission();

      expect(cb).not.toHaveBeenCalled();
    });
  });
});

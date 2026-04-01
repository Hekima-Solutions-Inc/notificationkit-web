import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushSubscriptionNamespace } from '../../src/push/pushSubscription';
import { PushManager } from '../../src/push/pushManager';

// ---------------------------------------------------------------------------
// PushSubscriptionNamespace
// ---------------------------------------------------------------------------

describe('PushSubscriptionNamespace', () => {
  let sub: PushSubscriptionNamespace;

  beforeEach(() => {
    sub = new PushSubscriptionNamespace();
  });

  it('has null id, null token, and optedIn=false as initial state', () => {
    expect(sub.id).toBeNull();
    expect(sub.token).toBeNull();
    expect(sub.optedIn).toBe(false);
  });

  it('_update() sets id, token, and optedIn', () => {
    sub._update('user-123', 'https://push.example.com/endpoint', true);
    expect(sub.id).toBe('user-123');
    expect(sub.token).toBe('https://push.example.com/endpoint');
    expect(sub.optedIn).toBe(true);
  });

  it('_update() can reset state to null/false', () => {
    sub._update('user-123', 'https://push.example.com/endpoint', true);
    sub._update(null, null, false);
    expect(sub.id).toBeNull();
    expect(sub.token).toBeNull();
    expect(sub.optedIn).toBe(false);
  });

  it('optOut() calls unsubscribe when a subscription exists', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const mockPushManagerNs = {
      getSubscription: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example.com/endpoint',
        unsubscribe: mockUnsubscribe,
      }),
    };
    const mockReg = { pushManager: mockPushManagerNs };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    sub._update(null, 'https://push.example.com/endpoint', true);
    await sub.optOut();

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
    expect(sub.optedIn).toBe(false);
    expect(sub.token).toBeNull();
  });

  it('optOut() does nothing when no subscription exists', async () => {
    const mockPushManagerNs = {
      getSubscription: vi.fn().mockResolvedValue(null),
    };
    const mockReg = { pushManager: mockPushManagerNs };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    // Should not throw
    await expect(sub.optOut()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PushManager
// ---------------------------------------------------------------------------

describe('PushManager', () => {
  let pushSub: PushSubscriptionNamespace;

  beforeEach(() => {
    pushSub = new PushSubscriptionNamespace();
  });

  it('subscribe() returns null when no VAPID key is provided', async () => {
    const manager = new PushManager(undefined, pushSub);
    const result = await manager.subscribe();
    expect(result).toBeNull();
  });

  it('subscribe() returns null when serviceWorker registration has no pushManager', async () => {
    // Simulate a registration that does not expose a pushManager (e.g. unsupported browser)
    const mockReg = { pushManager: undefined };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    const manager = new PushManager('SOME_VAPID_KEY', pushSub);
    const result = await manager.subscribe();
    expect(result).toBeNull();
  });

  it('getSubscription() returns null when serviceWorker registration has no pushManager', async () => {
    const mockReg = { pushManager: undefined };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    const manager = new PushManager('SOME_VAPID_KEY', pushSub);
    const result = await manager.getSubscription();
    expect(result).toBeNull();
  });

  it('subscribe() returns existing subscription if already subscribed', async () => {
    const mockEndpoint = 'https://push.example.com/existing';
    const mockExistingSub = { endpoint: mockEndpoint, unsubscribe: vi.fn() };
    const mockPushManagerNs = {
      getSubscription: vi.fn().mockResolvedValue(mockExistingSub),
      subscribe: vi.fn(),
    };
    const mockReg = { pushManager: mockPushManagerNs };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    const manager = new PushManager('VALID_VAPID_KEY', pushSub);
    const result = await manager.subscribe();

    expect(result).toBe(mockExistingSub);
    expect(mockPushManagerNs.subscribe).not.toHaveBeenCalled();
    expect(pushSub.token).toBe(mockEndpoint);
    expect(pushSub.optedIn).toBe(true);
  });

  it('unsubscribe() updates pushSubscription state to null/false', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const mockExistingSub = { endpoint: 'https://push.example.com/ep', unsubscribe: mockUnsubscribe };
    const mockPushManagerNs = {
      getSubscription: vi.fn().mockResolvedValue(mockExistingSub),
    };
    const mockReg = { pushManager: mockPushManagerNs };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      configurable: true,
    });

    pushSub._update(null, 'https://push.example.com/ep', true);
    const manager = new PushManager('VALID_VAPID_KEY', pushSub);
    await manager.unsubscribe();

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
    expect(pushSub.token).toBeNull();
    expect(pushSub.optedIn).toBe(false);
  });
});

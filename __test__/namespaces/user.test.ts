import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserNamespace } from '../../src/namespaces/user';
import { NotificationKitHttp } from '../../src/core/http';
import { storage } from '../../src/utils/storage';

function makeMockHttp() {
  const calls: { path: string; body: any }[] = [];
  const mockHttp = {
    post: vi.fn(async (path: string, body: any) => {
      calls.push({ path, body });
      return { ok: true };
    }),
    get: vi.fn(async () => null),
  } as unknown as NotificationKitHttp;
  return { mockHttp, calls };
}

describe('UserNamespace', () => {
  const USER_ID = 'user-abc';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('addAlias()', () => {
    it('sends POST to sdk-alias with add action', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.addAlias('email', 'test@example.com');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-alias');
      expect(calls[0].body).toEqual({
        app_user_id: USER_ID,
        action: 'add',
        aliases: { email: 'test@example.com' },
      });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => null);

      await expect(user.addAlias('email', 'test@example.com')).rejects.toThrow('No userId set');
    });
  });

  describe('removeAlias()', () => {
    it('sends POST to sdk-alias with remove action', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.removeAlias('email');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-alias');
      expect(calls[0].body).toEqual({
        app_user_id: USER_ID,
        action: 'remove',
        labels: ['email'],
      });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => null);

      await expect(user.removeAlias('email')).rejects.toThrow('No userId set');
    });
  });

  describe('addEmail()', () => {
    it('sends POST to sdk-subscription with token field (not value)', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.addEmail('user@example.com');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-subscription');
      expect(calls[0].body).toMatchObject({ token: 'user@example.com' });
      expect(calls[0].body).not.toHaveProperty('value');
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => null);

      await expect(user.addEmail('user@example.com')).rejects.toThrow('No userId set');
    });
  });

  describe('removeEmail()', () => {
    it('sends POST to sdk-subscription with token field', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.removeEmail('user@example.com');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-subscription');
      expect(calls[0].body).toMatchObject({ token: 'user@example.com', action: 'remove' });
    });
  });

  describe('addSms()', () => {
    it('sends POST to sdk-subscription with token field', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.addSms('+15551234567');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-subscription');
      expect(calls[0].body).toMatchObject({ token: '+15551234567', type: 'sms' });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => null);

      await expect(user.addSms('+15551234567')).rejects.toThrow('No userId set');
    });
  });

  describe('setLanguage()', () => {
    it('sends POST to sdk-identify with language field', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.setLanguage('en');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-identify');
      expect(calls[0].body).toMatchObject({ app_user_id: USER_ID, language: 'en' });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => null);

      await expect(user.setLanguage('en')).rejects.toThrow('No userId set');
    });
  });

  describe('addTag()', () => {
    it('delegates to TagsManager with correct set format', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      await user.addTag('plan', 'premium');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-tags');
      expect(calls[0].body).toEqual({
        app_user_id: USER_ID,
        action: 'set',
        label: 'plan',
        value: 'premium',
      });
    });
  });

  describe('getTags()', () => {
    it('returns empty object when no tags cached', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);

      expect(user.getTags()).toEqual({});
    });

    it('returns cached tags from localStorage', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);
      storage.setJSON('tags', { plan: 'premium', role: 'admin' });

      expect(user.getTags()).toEqual({ plan: 'premium', role: 'admin' });
    });
  });

  describe('_updateIds()', () => {
    it('fires change event listeners when IDs change', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);
      const cb = vi.fn();
      user.addEventListener('change', cb);

      user._updateIds({ nkUserId: 'nk-1', externalId: 'ext-1' });

      expect(cb).toHaveBeenCalledWith({ nkUserId: 'nk-1', externalId: 'ext-1' });
    });

    it('does not fire listeners when IDs are unchanged', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);
      const cb = vi.fn();
      user._updateIds({ nkUserId: 'nk-1', externalId: 'ext-1' });
      user.addEventListener('change', cb);

      // Call again with same values — should not fire
      user._updateIds({ nkUserId: 'nk-1', externalId: 'ext-1' });

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('addEventListener / removeEventListener', () => {
    it('registers and receives change events', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);
      const cb = vi.fn();
      user.addEventListener('change', cb);

      user._updateIds({ nkUserId: 'nk-2', externalId: null });

      expect(cb).toHaveBeenCalledOnce();
    });

    it('stops receiving events after removeEventListener', () => {
      const { mockHttp } = makeMockHttp();
      const user = new UserNamespace(mockHttp, () => USER_ID);
      const cb = vi.fn();
      user.addEventListener('change', cb);
      user.removeEventListener('change', cb);

      user._updateIds({ nkUserId: 'nk-3', externalId: null });

      expect(cb).not.toHaveBeenCalled();
    });
  });
});

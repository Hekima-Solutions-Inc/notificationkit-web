import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagsManager } from '../../src/namespaces/tags';
import { NotificationKitHttp } from '../../src/core/http';

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

describe('TagsManager', () => {
  const USER_ID = 'user-123';

  describe('add()', () => {
    it('sends POST to sdk-tags with correct set payload', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => USER_ID);

      await tags.add('plan', 'premium');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-tags');
      expect(calls[0].body).toEqual({
        app_user_id: USER_ID,
        action: 'set',
        label: 'plan',
        value: 'premium',
      });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => null);

      await expect(tags.add('plan', 'premium')).rejects.toThrow('No userId set');
    });
  });

  describe('remove()', () => {
    it('sends POST to sdk-tags with correct remove payload', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => USER_ID);

      await tags.remove('plan');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-tags');
      expect(calls[0].body).toEqual({
        app_user_id: USER_ID,
        action: 'remove',
        label: 'plan',
      });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => null);

      await expect(tags.remove('plan')).rejects.toThrow('No userId set');
    });
  });

  describe('addMultiple()', () => {
    it('calls add() for each tag entry', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => USER_ID);

      await tags.addMultiple({ plan: 'premium', role: 'admin' });

      expect(calls).toHaveLength(2);
      expect(calls[0].body).toMatchObject({ action: 'set', label: 'plan', value: 'premium' });
      expect(calls[1].body).toMatchObject({ action: 'set', label: 'role', value: 'admin' });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => null);

      await expect(tags.addMultiple({ plan: 'premium' })).rejects.toThrow('No userId set');
    });
  });

  describe('removeMultiple()', () => {
    it('calls remove() for each label', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => USER_ID);

      await tags.removeMultiple(['plan', 'role']);

      expect(calls).toHaveLength(2);
      expect(calls[0].body).toMatchObject({ action: 'remove', label: 'plan' });
      expect(calls[1].body).toMatchObject({ action: 'remove', label: 'role' });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const tags = new TagsManager(mockHttp, () => null);

      await expect(tags.removeMultiple(['plan'])).rejects.toThrow('No userId set');
    });
  });
});

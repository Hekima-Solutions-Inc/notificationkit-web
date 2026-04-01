import { describe, it, expect, vi } from 'vitest';
import { SessionNamespace } from '../../src/namespaces/session';
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

describe('SessionNamespace', () => {
  const USER_ID = 'user-session-1';

  describe('addOutcome()', () => {
    it('sends POST to sdk-outcome with name', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => USER_ID);

      await session.addOutcome('purchase');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-outcome');
      expect(calls[0].body).toEqual({ app_user_id: USER_ID, name: 'purchase' });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => null);

      await expect(session.addOutcome('purchase')).rejects.toThrow('No userId set');
    });
  });

  describe('addUniqueOutcome()', () => {
    it('sends POST to sdk-outcome with unique: true', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => USER_ID);

      await session.addUniqueOutcome('signup');

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-outcome');
      expect(calls[0].body).toEqual({ app_user_id: USER_ID, name: 'signup', unique: true });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => null);

      await expect(session.addUniqueOutcome('signup')).rejects.toThrow('No userId set');
    });
  });

  describe('addOutcomeWithValue()', () => {
    it('sends POST to sdk-outcome with value', async () => {
      const { mockHttp, calls } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => USER_ID);

      await session.addOutcomeWithValue('revenue', 49.99);

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe('sdk-outcome');
      expect(calls[0].body).toEqual({ app_user_id: USER_ID, name: 'revenue', value: 49.99 });
    });

    it('throws if no userId is set', async () => {
      const { mockHttp } = makeMockHttp();
      const session = new SessionNamespace(mockHttp, () => null);

      await expect(session.addOutcomeWithValue('revenue', 10)).rejects.toThrow('No userId set');
    });
  });
});

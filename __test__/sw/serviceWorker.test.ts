import { describe, it, expect, beforeEach } from 'vitest';
import { idb } from '../../src/utils/idb';

// fake-indexeddb/auto is imported in __test__/setup.ts, providing a full
// in-memory IndexedDB implementation for these tests.

describe('idb utility (used by service worker layer)', () => {
  // Each test gets a clean slate – remove the keys we use so tests are isolated.
  beforeEach(async () => {
    await idb.remove('testKey');
    await idb.remove('numKey');
    await idb.remove('objKey');
  });

  it('set() stores a string value and get() retrieves it', async () => {
    await idb.set('testKey', 'hello-world');
    const value = await idb.get<string>('testKey');
    expect(value).toBe('hello-world');
  });

  it('get() returns null for a key that has never been set', async () => {
    const value = await idb.get('testKey');
    expect(value).toBeNull();
  });

  it('remove() deletes a stored value so get() returns null afterwards', async () => {
    await idb.set('testKey', 'to-be-deleted');
    await idb.remove('testKey');
    const value = await idb.get('testKey');
    expect(value).toBeNull();
  });

  it('set() overwrites an existing value', async () => {
    await idb.set('testKey', 'first');
    await idb.set('testKey', 'second');
    const value = await idb.get<string>('testKey');
    expect(value).toBe('second');
  });

  it('stores and retrieves numeric values', async () => {
    await idb.set('numKey', 42);
    const value = await idb.get<number>('numKey');
    expect(value).toBe(42);
  });

  it('stores and retrieves object values', async () => {
    const obj = { apiKey: 'key-abc', baseUrl: 'https://example.com' };
    await idb.set('objKey', obj);
    const value = await idb.get<typeof obj>('objKey');
    expect(value).toEqual(obj);
  });

  it('remove() on a non-existent key does not throw', async () => {
    await expect(idb.remove('nonExistentKey')).resolves.toBeUndefined();
  });
});

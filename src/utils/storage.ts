const PREFIX = 'nk_';

export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(PREFIX + key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(PREFIX + key, value); } catch { /* ignore */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
  getJSON<T>(key: string): T | null {
    const v = storage.get(key);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  },
  setJSON(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
};

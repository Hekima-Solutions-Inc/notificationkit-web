import { NotificationKitError } from './errors';

export class NotificationKitHttp {
  private _apiKey: string;
  private _baseUrl: string;
  private _canSend: () => boolean;

  constructor(apiKey: string, baseUrl: string, canSend: () => boolean) {
    this._apiKey = apiKey;
    this._baseUrl = baseUrl;
    this._canSend = canSend;
  }

  async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T | null> {
    if (!this._canSend()) return null;
    const res = await fetch(`${this._baseUrl}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this._apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new NotificationKitError(text || res.statusText, res.status);
    }
    return res.json();
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T | null> {
    if (!this._canSend()) return null;
    const url = new URL(`${this._baseUrl}/functions/v1/${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': this._apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new NotificationKitError(text || res.statusText, res.status);
    }
    return res.json();
  }
}

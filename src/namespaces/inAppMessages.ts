import { NotificationKitHttp } from '../core/http';

interface InAppMessage {
  id: string;
  title?: string;
  body?: string;
  display_type: string;
  triggers?: string[];
  [key: string]: unknown;
}

type MessageCallback = (message: InAppMessage) => void;

export class InAppMessagesNamespace {
  private _http: NotificationKitHttp;
  private _getUserId: () => string | null;
  private _triggers: Record<string, string> = {};
  private _paused = false;
  _messages: InAppMessage[] = [];
  private _willDisplayListeners: MessageCallback[] = [];
  private _clickListeners: MessageCallback[] = [];

  constructor(http: NotificationKitHttp, getUserId: () => string | null) {
    this._http = http;
    this._getUserId = getUserId;
  }

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    this._paused = value;
  }

  addTrigger(key: string, value: string): void {
    this._triggers[key] = value;
    this._evaluateTrigger(`trigger:${key}:${value}`);
  }

  removeTrigger(key: string): void {
    delete this._triggers[key];
  }

  addEventListener(event: 'willDisplay', callback: MessageCallback): void;
  addEventListener(event: 'click', callback: MessageCallback): void;
  addEventListener(event: string, callback: Function): void {
    if (event === 'willDisplay') {
      this._willDisplayListeners.push(callback as MessageCallback);
    }
    if (event === 'click') {
      this._clickListeners.push(callback as MessageCallback);
    }
  }

  removeEventListener(event: 'willDisplay', callback: MessageCallback): void;
  removeEventListener(event: 'click', callback: MessageCallback): void;
  removeEventListener(event: string, callback: Function): void {
    if (event === 'willDisplay') {
      this._willDisplayListeners = this._willDisplayListeners.filter(cb => cb !== callback);
    }
    if (event === 'click') {
      this._clickListeners = this._clickListeners.filter(cb => cb !== callback);
    }
  }

  // Internal: evaluate trigger and check if any in-app messages match
  _evaluateTrigger(_trigger: string): void {
    if (this._paused) return;
    // Trigger evaluation will check cached messages — for MVP, we just log
    // Full trigger matching can be expanded later
  }

  _clearCache(): void {
    this._messages = [];
    this._triggers = {};
  }

  async _fetchMessages(): Promise<void> {
    const uid = this._getUserId();
    if (!uid) return;
    const messages = await this._http.get<InAppMessage[]>('sdk-in-app', { app_user_id: uid });
    if (messages) {
      this._messages = messages;
    }
  }
}

import { NotificationKitHttp } from '../core/http';
import { UserState } from '../core/types';
import { storage } from '../utils/storage';
import { TagsManager } from './tags';
import { PushSubscriptionNamespace } from '../push/pushSubscription';

type UserChangeCallback = (state: UserState) => void;

export class UserNamespace {
  private _http: NotificationKitHttp;
  private _getUserId: () => string | null;
  private _tags: TagsManager;
  private _listeners: UserChangeCallback[] = [];
  private _nkUserId: string | null = null;
  private _externalId: string | null = null;

  PushSubscription: PushSubscriptionNamespace;

  constructor(http: NotificationKitHttp, getUserId: () => string | null) {
    this._http = http;
    this._getUserId = getUserId;
    this._tags = new TagsManager(http, getUserId);
    this.PushSubscription = new PushSubscriptionNamespace();
  }

  // Called by NotificationKit core to update user IDs
  _updateIds(state: UserState): void {
    const changed = state.nkUserId !== this._nkUserId || state.externalId !== this._externalId;
    this._nkUserId = state.nkUserId;
    this._externalId = state.externalId;
    if (changed) {
      for (const cb of this._listeners) {
        cb({ nkUserId: this._nkUserId, externalId: this._externalId });
      }
    }
  }

  // Aliases
  async addAlias(label: string, id: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-alias', {
      app_user_id: uid,
      action: 'add',
      aliases: { [label]: id },
    });
  }

  async addAliases(aliases: Record<string, string>): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-alias', {
      app_user_id: uid,
      action: 'add',
      aliases,
    });
  }

  async removeAlias(label: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-alias', {
      app_user_id: uid,
      action: 'remove',
      labels: [label],
    });
  }

  async removeAliases(labels: string[]): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-alias', {
      app_user_id: uid,
      action: 'remove',
      labels,
    });
  }

  // Email/SMS subscriptions - uses CORRECT 'token' field
  async addEmail(email: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-subscription', {
      app_user_id: uid,
      action: 'add',
      type: 'email',
      token: email,
    });
  }

  async removeEmail(email: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-subscription', {
      app_user_id: uid,
      action: 'remove',
      type: 'email',
      token: email,
    });
  }

  async addSms(number: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-subscription', {
      app_user_id: uid,
      action: 'add',
      type: 'sms',
      token: number,
    });
  }

  async removeSms(number: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-subscription', {
      app_user_id: uid,
      action: 'remove',
      type: 'sms',
      token: number,
    });
  }

  // Language
  async setLanguage(language: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-identify', {
      app_user_id: uid,
      language,
    });
  }

  // Tags - delegates to TagsManager
  async addTag(label: string, value: string): Promise<void> {
    return this._tags.add(label, value);
  }

  async addTags(tags: Record<string, string>): Promise<void> {
    return this._tags.addMultiple(tags);
  }

  async removeTag(label: string): Promise<void> {
    return this._tags.remove(label);
  }

  async removeTags(labels: string[]): Promise<void> {
    return this._tags.removeMultiple(labels);
  }

  // Tags are cached from login response, no network call
  getTags(): Record<string, string> {
    return storage.getJSON<Record<string, string>>('tags') || {};
  }

  // Event listeners
  addEventListener(event: 'change', callback: UserChangeCallback): void {
    if (event === 'change') {
      this._listeners.push(callback);
    }
  }

  removeEventListener(event: 'change', callback: UserChangeCallback): void {
    if (event === 'change') {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    }
  }
}

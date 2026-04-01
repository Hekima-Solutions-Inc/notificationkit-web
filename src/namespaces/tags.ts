import { NotificationKitHttp } from '../core/http';

export class TagsManager {
  private _http: NotificationKitHttp;
  private _getUserId: () => string | null;

  constructor(http: NotificationKitHttp, getUserId: () => string | null) {
    this._http = http;
    this._getUserId = getUserId;
  }

  async add(label: string, value: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-tags', {
      app_user_id: uid,
      action: 'set',
      label,
      value,
    });
  }

  async addMultiple(tags: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(tags)) {
      await this.add(label, value);
    }
  }

  async remove(label: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-tags', {
      app_user_id: uid,
      action: 'remove',
      label,
    });
  }

  async removeMultiple(labels: string[]): Promise<void> {
    for (const label of labels) {
      await this.remove(label);
    }
  }
}

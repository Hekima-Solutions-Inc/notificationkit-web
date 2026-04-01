import { NotificationKitHttp } from '../core/http';

export class SessionNamespace {
  private _http: NotificationKitHttp;
  private _getUserId: () => string | null;

  constructor(http: NotificationKitHttp, getUserId: () => string | null) {
    this._http = http;
    this._getUserId = getUserId;
  }

  async addOutcome(name: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-outcome', {
      app_user_id: uid,
      name,
    });
  }

  async addUniqueOutcome(name: string): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-outcome', {
      app_user_id: uid,
      name,
      unique: true,
    });
  }

  async addOutcomeWithValue(name: string, value: number): Promise<void> {
    const uid = this._getUserId();
    if (!uid) throw new Error('No userId set. Call login() first.');
    await this._http.post('sdk-outcome', {
      app_user_id: uid,
      name,
      value,
    });
  }
}

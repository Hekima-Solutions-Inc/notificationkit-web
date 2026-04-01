export class PushSubscriptionNamespace {
  private _id: string | null = null;
  private _token: string | null = null;
  private _optedIn = false;

  get id(): string | null { return this._id; }
  get token(): string | null { return this._token; }
  get optedIn(): boolean { return this._optedIn; }

  async optIn(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      this._optedIn = true;
      this._token = sub.endpoint;
      return;
    }
    // If no subscription exists, we need VAPID key to subscribe
    // This will be wired up when backend VAPID support is added
  }

  async optOut(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      this._optedIn = false;
      this._token = null;
    }
  }

  // Internal: update state from push manager
  _update(id: string | null, token: string | null, optedIn: boolean): void {
    this._id = id;
    this._token = token;
    this._optedIn = optedIn;
  }
}

import { PushSubscriptionNamespace } from './pushSubscription';

export class PushManager {
  private _vapidPublicKey: string | null;
  private _pushSubscription: PushSubscriptionNamespace;

  constructor(vapidPublicKey: string | undefined, pushSubscription: PushSubscriptionNamespace) {
    this._vapidPublicKey = vapidPublicKey || null;
    this._pushSubscription = pushSubscription;
  }

  async subscribe(): Promise<PushSubscription | null> {
    if (!this._vapidPublicKey) return null;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return null;

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      this._pushSubscription._update(null, sub.endpoint, true);
      return sub;
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = this._urlBase64ToUint8Array(this._vapidPublicKey).buffer as ArrayBuffer;

    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    this._pushSubscription._update(null, sub.endpoint, true);
    return sub;
  }

  async unsubscribe(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      this._pushSubscription._update(null, null, false);
    }
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return null;

    return reg.pushManager.getSubscription();
  }

  // Helper to convert base64url VAPID key to Uint8Array
  private _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

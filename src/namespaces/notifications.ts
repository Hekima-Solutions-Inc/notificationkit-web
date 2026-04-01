import { NotificationKitConfig } from '../core/config';

type PermissionChangeCallback = (permission: NotificationPermission) => void;
type ClickCallback = (data: unknown) => void;

export class NotificationsNamespace {
  _config: NotificationKitConfig;
  private _permissionListeners: PermissionChangeCallback[] = [];
  private _clickListeners: ClickCallback[] = [];

  constructor(config: NotificationKitConfig) {
    this._config = config;
  }

  get permission(): NotificationPermission {
    if (typeof Notification === 'undefined') return 'default';
    return Notification.permission;
  }

  isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isPushSupported()) return 'default';
    const prev = this.permission;
    const result = await Notification.requestPermission();
    if (result !== prev) {
      for (const cb of this._permissionListeners) cb(result);
    }
    return result;
  }

  addEventListener(event: 'permissionChange', callback: PermissionChangeCallback): void;
  addEventListener(event: 'click', callback: ClickCallback): void;
  addEventListener(event: string, callback: Function): void {
    if (event === 'permissionChange') {
      this._permissionListeners.push(callback as PermissionChangeCallback);
    }
    if (event === 'click') {
      this._clickListeners.push(callback as ClickCallback);
    }
  }

  removeEventListener(event: 'permissionChange', callback: PermissionChangeCallback): void;
  removeEventListener(event: 'click', callback: ClickCallback): void;
  removeEventListener(event: string, callback: Function): void {
    if (event === 'permissionChange') {
      this._permissionListeners = this._permissionListeners.filter(cb => cb !== callback);
    }
    if (event === 'click') {
      this._clickListeners = this._clickListeners.filter(cb => cb !== callback);
    }
  }

  // Called internally when SW posts a click event
  _onNotificationClick(data: unknown): void {
    for (const cb of this._clickListeners) cb(data);
  }
}

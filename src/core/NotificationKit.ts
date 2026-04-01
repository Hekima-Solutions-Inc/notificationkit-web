import { InitConfig, NotificationKitConfig, DEFAULT_BASE_URL, DEFAULT_SW_PATH } from './config';
import { NotificationKitError } from './errors';
import { IdentifyOptions, LoginResponse } from './types';
import { NotificationKitHttp } from './http';
import { storage } from '../utils/storage';
import { idb } from '../utils/idb';
import { UserNamespace } from '../namespaces/user';
import { SessionNamespace } from '../namespaces/session';
import { NotificationsNamespace } from '../namespaces/notifications';
import { InAppMessagesNamespace } from '../namespaces/inAppMessages';
import { DebugNamespace } from '../namespaces/debug';

export class NotificationKit {
  private static _config: NotificationKitConfig | null = null;
  private static _http: NotificationKitHttp | null = null;
  private static _userId: string | null = null;
  private static _nkUserId: string | null = null;
  private static _consentRequired = false;
  private static _consentGiven = false;
  private static _initialized = false;
  private static _channel: BroadcastChannel | null = null;

  static User: UserNamespace;
  static Session: SessionNamespace;
  static Notifications: NotificationsNamespace;
  static InAppMessages: InAppMessagesNamespace;
  static Debug: DebugNamespace;

  private constructor() {}

  static get userId(): string | null { return NotificationKit._userId; }
  static get nkUserId(): string | null { return NotificationKit._nkUserId; }

  static init(options: InitConfig): void {
    if (NotificationKit._initialized) return;

    const config: NotificationKitConfig = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || DEFAULT_BASE_URL,
      serviceWorkerPath: options.serviceWorkerPath || DEFAULT_SW_PATH,
      vapidPublicKey: options.vapidPublicKey,
      requireConsent: options.requireConsent || false,
    };

    NotificationKit._config = config;
    NotificationKit._consentRequired = config.requireConsent;
    NotificationKit._http = new NotificationKitHttp(
      config.apiKey,
      config.baseUrl,
      () => !NotificationKit._consentRequired || NotificationKit._consentGiven
    );

    // Initialize namespaces
    NotificationKit.Debug = new DebugNamespace();
    NotificationKit.User = new UserNamespace(NotificationKit._http, () => NotificationKit._userId);
    NotificationKit.Session = new SessionNamespace(NotificationKit._http, () => NotificationKit._userId);
    NotificationKit.Notifications = new NotificationsNamespace(config);
    NotificationKit.InAppMessages = new InAppMessagesNamespace(NotificationKit._http, () => NotificationKit._userId);

    NotificationKit._initialized = true;

    // Restore persisted state
    NotificationKit._restoreState();

    // Register service worker (fire-and-forget)
    NotificationKit._registerServiceWorker();

    // Multi-tab sync
    NotificationKit._setupBroadcastChannel();

    // Persist credentials to IDB for service worker
    idb.set('apiKey', config.apiKey);
    idb.set('baseUrl', config.baseUrl);
  }

  static async login(userId: string): Promise<string> {
    NotificationKit._assertInitialized();

    NotificationKit._userId = userId;

    const response = await NotificationKit._http!.post<LoginResponse>('sdk-identify', {
      app_user_id: userId,
      platform: 'web',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (response) {
      NotificationKit._nkUserId = response.app_user_id;
      // Cache tags from response
      storage.setJSON('tags', response.tags || {});
      // Persist to IDB for service worker
      await idb.set('userId', userId);
      await idb.set('nkUserId', response.app_user_id);
      // Update user namespace
      NotificationKit.User._updateIds({
        nkUserId: response.app_user_id,
        externalId: userId,
      });
    }

    // Persist to localStorage for quick restore
    storage.set('userId', userId);
    if (NotificationKit._nkUserId) storage.set('nkUserId', NotificationKit._nkUserId);

    return NotificationKit._nkUserId || userId;
  }

  static async identify(options: IdentifyOptions): Promise<void> {
    NotificationKit._assertInitialized();
    if (!NotificationKit._userId) {
      throw new NotificationKitError('No userId set. Call login() first.');
    }

    const body: Record<string, unknown> = { app_user_id: NotificationKit._userId };
    if (options.email !== undefined) body.email = options.email;
    if (options.firstName !== undefined) body.first_name = options.firstName;
    if (options.lastName !== undefined) body.last_name = options.lastName;
    if (options.language !== undefined) body.language = options.language;
    if (options.attributes) {
      const reserved = new Set(['app_user_id', 'platform', 'email', 'first_name', 'last_name', 'fcm_token', 'timezone', 'language']);
      for (const [k, v] of Object.entries(options.attributes)) {
        if (!reserved.has(k)) body[k] = v;
      }
    }

    await NotificationKit._http!.post('sdk-identify', body);
  }

  static async track(event: string, properties?: Record<string, unknown>): Promise<void> {
    NotificationKit._assertInitialized();
    if (!NotificationKit._userId) {
      throw new NotificationKitError('No userId set. Call login() first.');
    }

    await NotificationKit._http!.post('sdk-track', {
      app_user_id: NotificationKit._userId,
      event,
      ...(properties && { properties }),
    });

    // Evaluate in-app message triggers
    NotificationKit.InAppMessages._evaluateTrigger(`event:${event}`);
  }

  static async logout(): Promise<void> {
    NotificationKit._assertInitialized();
    if (NotificationKit._userId) {
      try {
        await NotificationKit._http!.post('sdk-logout', { app_user_id: NotificationKit._userId });
      } catch {
        // Fire-and-forget
      }
    }

    NotificationKit._clearState();

    // Broadcast logout to other tabs
    NotificationKit._channel?.postMessage({ type: 'NK_LOGOUT' });
  }

  static setConsentRequired(required: boolean): void {
    NotificationKit._consentRequired = required;
  }

  static setConsentGiven(given: boolean): void {
    NotificationKit._consentGiven = given;
    storage.set('consent', given ? '1' : '0');
  }

  // Internal methods

  private static _assertInitialized(): void {
    if (!NotificationKit._initialized || !NotificationKit._config) {
      throw new NotificationKitError('NotificationKit not initialized. Call NotificationKit.init() first.');
    }
  }

  private static _restoreState(): void {
    NotificationKit._userId = storage.get('userId');
    NotificationKit._nkUserId = storage.get('nkUserId');
    const consent = storage.get('consent');
    if (consent !== null) NotificationKit._consentGiven = consent === '1';

    if (NotificationKit._userId) {
      NotificationKit.User._updateIds({
        nkUserId: NotificationKit._nkUserId,
        externalId: NotificationKit._userId,
      });
    }
  }

  private static _clearState(): void {
    NotificationKit._userId = null;
    NotificationKit._nkUserId = null;
    storage.remove('userId');
    storage.remove('nkUserId');
    storage.remove('tags');
    idb.remove('userId');
    idb.remove('nkUserId');
    NotificationKit.User._updateIds({ nkUserId: null, externalId: null });
    NotificationKit.InAppMessages._clearCache();
  }

  private static _registerServiceWorker(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(NotificationKit._config!.serviceWorkerPath).catch(() => {
      // Service worker registration failed — push will not work but SDK continues
    });
  }

  private static _setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    NotificationKit._channel = new BroadcastChannel('notificationkit');
    NotificationKit._channel.onmessage = (event) => {
      if (event.data?.type === 'NK_LOGOUT') {
        NotificationKit._clearState();
      }
    };
  }
}

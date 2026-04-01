export interface NotificationKitConfig {
  apiKey: string;
  baseUrl: string;
  serviceWorkerPath: string;
  vapidPublicKey?: string;
  requireConsent: boolean;
}

export const DEFAULT_BASE_URL = 'https://zfxiqldbmbxvkijhbfcw.supabase.co';
export const DEFAULT_SW_PATH = '/NotificationKitWorker.js';

export interface InitConfig {
  apiKey: string;
  baseUrl?: string;
  serviceWorkerPath?: string;
  vapidPublicKey?: string;
  requireConsent?: boolean;
}

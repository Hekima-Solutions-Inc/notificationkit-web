export interface UserState {
  nkUserId: string | null;
  externalId: string | null;
}

export interface IdentifyOptions {
  email?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  attributes?: Record<string, unknown>;
}

export interface LoginResponse {
  app_user_id: string;
  subscription_id: string | null;
  tags: Record<string, string>;
}

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

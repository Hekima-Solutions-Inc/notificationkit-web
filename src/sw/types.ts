// Push notification payload sent by the server
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  url?: string;
  message_id?: string;
  data?: Record<string, unknown>;
}

// Messages between page and service worker
export type SWMessageType = 'NK_INIT' | 'NK_PUSH_CLICKED' | 'NK_PUSH_RECEIVED';

export interface SWMessage {
  type: SWMessageType;
  payload?: unknown;
}

export interface NKInitPayload {
  apiKey: string;
  baseUrl: string;
  userId?: string;
}

export interface NKPushClickedPayload {
  message_id?: string;
  url?: string;
  data?: Record<string, unknown>;
}

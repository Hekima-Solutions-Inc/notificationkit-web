/// <reference lib="webworker" />

import type { PushPayload, NKPushClickedPayload, NKInitPayload, SWMessage } from './types';

declare const self: ServiceWorkerGlobalScope;

const DB_NAME = 'notificationkit';
const STORE_NAME = 'state';

// Minimal IDB helper for service worker (can't import from utils/idb.ts since this is a separate bundle)
async function idbGet<T = string>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const getReq = tx.objectStore(STORE_NAME).get(key);
        getReq.onsuccess = () => resolve(getReq.result ?? null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Handle push events
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const handler = async () => {
    let payload: PushPayload;
    try {
      payload = event.data!.json() as PushPayload;
    } catch {
      // Try text fallback
      payload = { title: 'New Notification', body: event.data!.text() };
    }

    const options: NotificationOptions & { image?: string } = {
      body: payload.body,
      icon: payload.icon,
      image: payload.image,
      badge: payload.badge,
      data: {
        url: payload.url,
        message_id: payload.message_id,
        ...payload.data,
      },
    };

    await self.registration.showNotification(payload.title, options);

    // Notify page clients about the push
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'NK_PUSH_RECEIVED',
        payload: { message_id: payload.message_id },
      } satisfies SWMessage);
    }
  };

  event.waitUntil(handler());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url as string | undefined;
  const messageId = data.message_id as string | undefined;

  const handler = async () => {
    // Open or focus the target URL
    if (url) {
      const clients = await self.clients.matchAll({ type: 'window' });
      // Try to focus an existing tab
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          await client.focus();
          break;
        }
      }
      // If no existing tab, open new window
      await self.clients.openWindow(url);
    }

    // Track push opened (fire-and-forget)
    if (messageId) {
      try {
        const apiKey = await idbGet<string>('apiKey');
        const baseUrl = await idbGet<string>('baseUrl');
        const userId = await idbGet<string>('userId');

        if (apiKey && baseUrl && userId) {
          fetch(`${baseUrl}/functions/v1/sdk-push-opened`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({
              app_user_id: userId,
              message_id: messageId,
            }),
          }).catch(() => {
            // Fire-and-forget
          });
        }
      } catch {
        // Fire-and-forget
      }
    }

    // Notify page clients about the click
    const clients = await self.clients.matchAll({ type: 'window' });
    const clickPayload: NKPushClickedPayload = {
      message_id: messageId,
      url,
      data: data as Record<string, unknown>,
    };
    for (const client of clients) {
      client.postMessage({
        type: 'NK_PUSH_CLICKED',
        payload: clickPayload,
      } satisfies SWMessage);
    }
  };

  event.waitUntil(handler());
});

// Handle notification close
self.addEventListener('notificationclose', (_event: NotificationEvent) => {
  // Optional: analytics for dismissed notifications
});

// Activate: claim clients immediately
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

// Handle messages from page
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as SWMessage;
  if (!msg || !msg.type) return;

  if (msg.type === 'NK_INIT') {
    // Page sends credentials to warm up IDB
    const payload = msg.payload as NKInitPayload;
    if (payload) {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(payload.apiKey, 'apiKey');
        store.put(payload.baseUrl, 'baseUrl');
        if (payload.userId) store.put(payload.userId, 'userId');
      };
    }
  }
});

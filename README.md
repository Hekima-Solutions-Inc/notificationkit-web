# NotificationKit Web SDK

JavaScript/TypeScript SDK for [NotificationKit](https://github.com/Hekima-Solutions-Inc/notificationkit) — a self-hosted notification platform for web push, in-app messages, and user engagement.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Service Worker Setup](#service-worker-setup)
- [Web Push Notifications](#web-push-notifications)
- [GDPR Consent](#gdpr-consent)
- [API Reference](#api-reference)
  - [Core](#core)
  - [User](#user-namespace)
  - [Notifications](#notifications-namespace)
  - [Session](#session-namespace)
  - [InAppMessages](#inappmessages-namespace)
  - [Debug](#debug-namespace)
- [TypeScript](#typescript)
- [Browser Support](#browser-support)
- [Error Handling](#error-handling)

---

## Installation

```bash
# npm
npm install notificationkit

# yarn
yarn add notificationkit

# pnpm
pnpm add notificationkit
```

### CDN (Script Tag)

```html
<script src="https://cdn.jsdelivr.net/npm/notificationkit/dist/notificationkit.umd.js"></script>
```

When loaded via CDN the SDK is available as the global `NotificationKit`.

---

## Quick Start

```typescript
import { NotificationKit } from 'notificationkit';

// 1. Initialize once on app load (no URL needed — it's built into the SDK)
NotificationKit.init({
  apiKey: 'YOUR_API_KEY',
});

// 2. Log in the current user
await NotificationKit.login('user-123');

// 3. Attach profile data
await NotificationKit.identify({
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
});

// 4. Request push permission and opt in
const permission = await NotificationKit.Notifications.requestPermission();
if (permission === 'granted') {
  await NotificationKit.User.PushSubscription.optIn();
}

// 5. Track a custom event
await NotificationKit.track('purchase_completed', { plan: 'pro', amount: 49 });
```

---

## Service Worker Setup

The SDK requires a service worker to receive web push notifications. Copy the bundled worker file into your public directory so it is served at the root of your site.

**Copy the worker file:**

```bash
# After installing the package
cp node_modules/notificationkit/dist/NotificationKitWorker.js public/NotificationKitWorker.js
```

By default the SDK registers the worker at `/NotificationKitWorker.js`. You can change this path with the `serviceWorkerPath` option:

```typescript
NotificationKit.init({
  apiKey: 'YOUR_API_KEY',
  serviceWorkerPath: '/workers/NotificationKitWorker.js',
});
```

If you use a build tool (Vite, webpack, etc.) you can import the worker path directly from the package:

```typescript
import workerUrl from 'notificationkit/worker';
```

> The service worker must be served from the same origin as your page and from the scope you want to receive notifications in. Placing it at `/NotificationKitWorker.js` gives it full-site scope.

---

## Web Push Notifications

### Check Support

```typescript
if (!NotificationKit.Notifications.isPushSupported()) {
  console.log('Push not supported in this browser');
}
```

### Request Permission

```typescript
const permission = await NotificationKit.Notifications.requestPermission();
// 'granted' | 'denied' | 'default'
```

### Opt In / Opt Out

```typescript
// Opt the current user into push
await NotificationKit.User.PushSubscription.optIn();

// Check current state
console.log(NotificationKit.User.PushSubscription.optedIn); // boolean
console.log(NotificationKit.User.PushSubscription.token);   // endpoint URL or null

// Opt out and remove the push subscription
await NotificationKit.User.PushSubscription.optOut();
```

### Listen for Notification Clicks

```typescript
NotificationKit.Notifications.addEventListener('click', (data) => {
  console.log('Notification clicked:', data);
});
```

### Listen for Permission Changes

```typescript
NotificationKit.Notifications.addEventListener('permissionChange', (permission) => {
  console.log('Permission changed to:', permission);
});
```

---

## GDPR Consent

When operating under GDPR or similar regulations you can gate all network activity behind explicit user consent.

```typescript
NotificationKit.init({
  apiKey: 'YOUR_API_KEY',
  requireConsent: true, // No network calls until consent is given
});

// After the user accepts your consent banner:
NotificationKit.setConsentGiven(true);

// To revoke consent:
NotificationKit.setConsentGiven(false);

// You can also change the requirement at runtime:
NotificationKit.setConsentRequired(false);
```

When `requireConsent` is `true` and consent has not been given, all HTTP requests are silently dropped until `setConsentGiven(true)` is called. Consent is persisted to `localStorage` so it survives page reloads.

---

## API Reference

### Core

#### `NotificationKit.init(config)`

Initialize the SDK. Must be called before any other method. Safe to call multiple times — subsequent calls are no-ops.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | `string` | Yes | — | Your NotificationKit API key |
| `serviceWorkerPath` | `string` | No | `'/NotificationKitWorker.js'` | Path to the service worker file |
| `vapidPublicKey` | `string` | No | — | VAPID public key for Web Push |
| `requireConsent` | `boolean` | No | `false` | Block network calls until consent is given |
| `baseUrl` | `string` | No | Built-in | Override the API base URL (only needed for self-hosting) |

```typescript
NotificationKit.init({
  apiKey: 'nk_live_abc123',
  serviceWorkerPath: '/NotificationKitWorker.js',
  vapidPublicKey: 'BExample...',
  requireConsent: false,
});
```

---

#### `NotificationKit.login(userId)` → `Promise<string>`

Associate the SDK with an authenticated user. Returns the internal NotificationKit user ID.

```typescript
const nkId = await NotificationKit.login('user-123');
```

| Parameter | Type | Description |
|---|---|---|
| `userId` | `string` | Your application's user identifier |

---

#### `NotificationKit.identify(options)` → `Promise<void>`

Update profile attributes for the current user. Requires `login()` to have been called first.

```typescript
await NotificationKit.identify({
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  language: 'en',
  attributes: { plan: 'pro', companyId: 'acme' },
});
```

| Parameter | Type | Description |
|---|---|---|
| `email` | `string?` | User email address |
| `firstName` | `string?` | First name |
| `lastName` | `string?` | Last name |
| `language` | `string?` | BCP-47 language tag (e.g. `'en'`, `'fr'`) |
| `attributes` | `Record<string, unknown>?` | Arbitrary key-value pairs (reserved keys are ignored) |

---

#### `NotificationKit.track(event, properties?)` → `Promise<void>`

Track a custom event for the current user. Also evaluates in-app message triggers.

```typescript
await NotificationKit.track('video_played', { videoId: 'abc', duration: 120 });
```

| Parameter | Type | Description |
|---|---|---|
| `event` | `string` | Event name |
| `properties` | `Record<string, unknown>?` | Optional event properties |

---

#### `NotificationKit.logout()` → `Promise<void>`

Log out the current user, clear all persisted state, and broadcast the logout to all open tabs.

```typescript
await NotificationKit.logout();
```

---

#### `NotificationKit.setConsentRequired(required)`

Toggle whether network calls require consent at runtime.

```typescript
NotificationKit.setConsentRequired(true);
```

---

#### `NotificationKit.setConsentGiven(given)`

Grant or revoke user consent. Persisted to `localStorage`.

```typescript
NotificationKit.setConsentGiven(true);
```

---

#### Read-only Getters

| Property | Type | Description |
|---|---|---|
| `NotificationKit.userId` | `string \| null` | Your application's user ID (set via `login()`) |
| `NotificationKit.nkUserId` | `string \| null` | NotificationKit's internal user ID |

---

### User Namespace

`NotificationKit.User`

#### Aliases

Aliases allow you to link multiple identifiers to the same user (e.g. a Stripe customer ID alongside your own user ID).

```typescript
// Add a single alias
await NotificationKit.User.addAlias('stripe_id', 'cus_abc123');

// Add multiple aliases at once
await NotificationKit.User.addAliases({
  stripe_id: 'cus_abc123',
  intercom_id: 'user_xyz',
});

// Remove aliases
await NotificationKit.User.removeAlias('stripe_id');
await NotificationKit.User.removeAliases(['stripe_id', 'intercom_id']);
```

#### Email & SMS Subscriptions

```typescript
// Email
await NotificationKit.User.addEmail('user@example.com');
await NotificationKit.User.removeEmail('user@example.com');

// SMS
await NotificationKit.User.addSms('+14155552671');
await NotificationKit.User.removeSms('+14155552671');
```

#### Language

```typescript
await NotificationKit.User.setLanguage('fr');
```

#### Tags

Tags are key-value pairs used for segmentation and targeting.

```typescript
// Add tags
await NotificationKit.User.addTag('plan', 'pro');
await NotificationKit.User.addTags({ plan: 'pro', region: 'us-west' });

// Remove tags
await NotificationKit.User.removeTag('plan');
await NotificationKit.User.removeTags(['plan', 'region']);

// Read cached tags (populated from login response, no network call)
const tags = NotificationKit.User.getTags();
// => { plan: 'pro', region: 'us-west' }
```

#### PushSubscription

```typescript
const push = NotificationKit.User.PushSubscription;

push.optedIn  // boolean — whether the user is currently opted in
push.token    // string | null — the Web Push endpoint URL
push.id       // string | null — subscription ID

await push.optIn();   // subscribe to push
await push.optOut();  // unsubscribe from push
```

#### Change Events

```typescript
NotificationKit.User.addEventListener('change', (state) => {
  console.log('User state changed:', state.nkUserId, state.externalId);
});

NotificationKit.User.removeEventListener('change', myCallback);
```

---

### Notifications Namespace

`NotificationKit.Notifications`

| Member | Type | Description |
|---|---|---|
| `permission` | `'granted' \| 'denied' \| 'default'` | Current browser notification permission |
| `isPushSupported()` | `() => boolean` | Returns `true` if the browser supports Web Push |
| `requestPermission()` | `() => Promise<NotificationPermission>` | Prompt the user for notification permission |
| `addEventListener('permissionChange', cb)` | — | Fired when permission changes |
| `addEventListener('click', cb)` | — | Fired when the user clicks a notification |
| `removeEventListener(event, cb)` | — | Remove a previously registered listener |

```typescript
// Check current permission without prompting
console.log(NotificationKit.Notifications.permission);

// Request permission
const result = await NotificationKit.Notifications.requestPermission();

// Listen for permission changes
NotificationKit.Notifications.addEventListener('permissionChange', (perm) => {
  if (perm === 'denied') console.warn('User denied notifications');
});

// Listen for notification clicks
NotificationKit.Notifications.addEventListener('click', (data) => {
  // data is the payload sent with the notification
  window.location.href = data.url;
});
```

---

### Session Namespace

`NotificationKit.Session`

Outcomes measure meaningful user actions tied to a session.

| Method | Description |
|---|---|
| `addOutcome(name)` | Record an outcome (can fire multiple times) |
| `addUniqueOutcome(name)` | Record an outcome only once per session |
| `addOutcomeWithValue(name, value)` | Record an outcome with a numeric value |

```typescript
// Track that the user converted
await NotificationKit.Session.addOutcome('conversion');

// Track a revenue outcome with a value
await NotificationKit.Session.addOutcomeWithValue('revenue', 49.99);

// Track a unique outcome (de-duplicated server-side)
await NotificationKit.Session.addUniqueOutcome('onboarding_completed');
```

---

### InAppMessages Namespace

`NotificationKit.InAppMessages`

#### Pause / Resume

```typescript
// Pause in-app message display (e.g. during a checkout flow)
NotificationKit.InAppMessages.paused = true;

// Resume
NotificationKit.InAppMessages.paused = false;
```

#### Triggers

Triggers allow you to show in-app messages based on user actions or state.

```typescript
// Set a trigger — fires matching in-app messages immediately
NotificationKit.InAppMessages.addTrigger('onboarding_step', '2');

// Remove a trigger
NotificationKit.InAppMessages.removeTrigger('onboarding_step');
```

#### Events

```typescript
// Before a message is shown
NotificationKit.InAppMessages.addEventListener('willDisplay', (message) => {
  console.log('About to display message:', message.id);
});

// When the user clicks a message action
NotificationKit.InAppMessages.addEventListener('click', (message) => {
  console.log('Message clicked:', message.id);
});

NotificationKit.InAppMessages.removeEventListener('willDisplay', myCallback);
NotificationKit.InAppMessages.removeEventListener('click', myCallback);
```

---

### Debug Namespace

`NotificationKit.Debug`

Control the verbosity of SDK console output. The default log level is `'warn'`.

| Level | Output |
|---|---|
| `'none'` | Silent — no console output |
| `'error'` | Errors only |
| `'warn'` | Errors and warnings (default) |
| `'info'` | Errors, warnings, and info messages |
| `'debug'` | All output including verbose debug traces |

```typescript
// Enable verbose logging during development
NotificationKit.Debug.setLogLevel('debug');

// Read the current level
const level = NotificationKit.Debug.getLogLevel(); // 'debug'

// Silence all SDK logs in production
NotificationKit.Debug.setLogLevel('none');
```

---

## TypeScript

The SDK ships with full TypeScript definitions. No `@types` package is needed.

```typescript
import {
  NotificationKit,
  NotificationKitError,
  type InitConfig,
  type IdentifyOptions,
  type UserState,
  type LogLevel,
} from 'notificationkit';

const config: InitConfig = {
  apiKey: 'nk_live_abc123',
  requireConsent: true,
};

NotificationKit.init(config);

NotificationKit.User.addEventListener('change', (state: UserState) => {
  console.log(state.nkUserId, state.externalId);
});
```

**Exported types:**

| Type | Description |
|---|---|
| `InitConfig` | Options accepted by `NotificationKit.init()` |
| `IdentifyOptions` | Options accepted by `NotificationKit.identify()` |
| `UserState` | Shape of the user change event payload |
| `LogLevel` | `'none' \| 'error' \| 'warn' \| 'info' \| 'debug'` |
| `NotificationKitError` | Error class thrown by SDK methods |

---

## Browser Support

The SDK targets modern evergreen browsers. Web Push requires additional platform support.

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| Core SDK | 60+ | 60+ | 12+ | 79+ |
| Web Push | 50+ | 44+ | 16.1+ (macOS/iOS) | 79+ |
| Service Worker | 40+ | 44+ | 11.1+ | 17+ |
| BroadcastChannel (multi-tab sync) | 54+ | 38+ | 15.4+ | 79+ |

> iOS Safari supports Web Push from iOS 16.4+ when the web app is added to the home screen.

---

## Error Handling

All async SDK methods can throw a `NotificationKitError`. The error includes a `status` property with the HTTP status code when the failure originates from a network request.

```typescript
import { NotificationKit, NotificationKitError } from 'notificationkit';

try {
  await NotificationKit.login('user-123');
} catch (err) {
  if (err instanceof NotificationKitError) {
    console.error(`SDK error [${err.status}]: ${err.message}`);
  } else {
    throw err;
  }
}
```

**Common errors:**

| Message | Cause |
|---|---|
| `NotificationKit not initialized. Call NotificationKit.init() first.` | A method was called before `init()` |
| `No userId set. Call login() first.` | A user-scoped method was called before `login()` |

Methods that communicate with the service worker (e.g. `PushSubscription.optIn()`) fail silently when the service worker is unavailable rather than throwing, so push functionality degrades gracefully without affecting the rest of the SDK.

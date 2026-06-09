You are a senior PWA engineer.
Your task is to fix ALL issues identified in docs/audits/PWA_OFFLINE_AUDIT_REPORT.md.
Read that file completely before making any changes.

Fix every issue in the following priority order.
Do not skip any item. Do not break any existing functionality.

═══════════════════════════════════════════════════════════
PHASE 1 — CRITICAL FIXES
═══════════════════════════════════════════════════════════

CRITICAL-1: \_next Static Assets Excluded from Service Worker Cache
File: public/sw.js (or public/sw.template.js)

The fetch interceptor explicitly skips caching for any request
containing /\_next/. This means all Next.js compiled JS bundles,
CSS chunks, and dynamic route scripts are never cached. When the
user is offline, every page navigation fails with a blank screen
because the scripts cannot load.

Fix:

- Remove the condition that skips fetch handling for /\_next/ URLs.
- Instead, apply a Cache-First strategy specifically for
  /\_next/static/ URLs (these are immutable, content-hashed assets
  that are safe to cache indefinitely).
- The cache key for \_next/static assets should use the full URL
  including the content hash so stale assets are never served
  after a deployment.
- Apply a Network-First strategy for /\_next/data/ URLs (these are
  dynamic page data fetches that should prefer fresh data).
- The updated fetch handler routing logic should be:
  1. If the URL is /\_next/static/ — Cache-First, cache name: 'static-assets'
  2. If the URL is /\_next/data/ — Network-First, fallback to cache
  3. If the URL is an API route (/api/) — Network-Only, never cache
  4. If the URL is a navigation request (HTML) — Network-First,
     fallback to the appropriate login shell (/employee/login or /admin/login)
  5. Everything else — Cache-First with network fallback
- On the service worker activate event, delete all old cache versions
  except the current CACHE_NAME to prevent stale asset accumulation.

---

CRITICAL-2: Break Actions Not Queued When Offline
File: src/app/employee/attendance/AttendanceClient.tsx
Functions: handleStartBreak, handleEndBreak (or wherever startBreak
and endBreak are called)

When an employee taps Start Break or End Break while offline, the
server action fails immediately with a network error and the action
is permanently lost. This causes incorrect productive hours tracking.

Fix:

- Extend the offline queue in src/lib/offline-queue.ts to support
  two new action types: 'break_start' and 'break_end'.
- Add 'break_start' | 'break_end' to the OfflineAttendanceEntry
  action type union.
- In the break start handler in AttendanceClient.tsx, wrap the
  startBreak() call in an online check:
  - If navigator.onLine is true, call startBreak() directly as now.
  - If navigator.onLine is false, call enqueueOfflineAction with
    action: 'break_start', using the current coords and fingerprint.
    Show a notification: "Break start queued — will sync when online."
    Update the local UI state optimistically to show Break status.
- Apply the same pattern to the end break handler with action: 'break_end'.
- In src/hooks/useOfflineSync.ts syncQueue function, add cases for
  'break_start' and 'break_end' in the switch statement:
  - For 'break_start': call startBreak() and handle the result.
  - For 'break_end': call endBreak() and handle the result.
- Break actions must be replayed in sequence order (break_start
  before break_end) which is already guaranteed by the sequential
  for loop in syncQueue.
- Add duplicate prevention for break actions: block a second
  'break_start' if one is already pending for the same shift date,
  and block a 'break_end' if no 'break_start' is pending or synced.

═══════════════════════════════════════════════════════════
PHASE 2 — HIGH FIXES
═══════════════════════════════════════════════════════════

HIGH-1: No Background Sync API Integration
File: src/hooks/useOfflineSync.ts
Also: public/sw.js

The offline queue only syncs when the React hook detects the
browser's 'online' event. If the user closes the app immediately
after reconnecting, queued check-ins and check-outs are never sent.

Fix — Service Worker:

- In public/sw.js, register a Background Sync event handler.
- Listen for the 'sync' event with tag 'attendance-sync'.
- When the sync event fires, post a message to all open clients
  with type: 'BACKGROUND_SYNC_TRIGGERED' so the client-side
  hook can run syncQueue().
- Register the sync tag from the client when items are added to
  the offline queue.

Fix — Client Side:

- In src/lib/offline-queue.ts enqueueOfflineAction function,
  after saving the entry to localStorage, attempt to register
  a Background Sync tag:
  - Check if navigator.serviceWorker and ServiceWorkerRegistration
    are available and if 'sync' is in the registration.
  - If Background Sync is supported, call
    registration.sync.register('attendance-sync').
  - Wrap in try/catch — if Background Sync is not supported
    (iOS Safari), fall back silently to the existing online
    event listener approach.
- In src/hooks/useOfflineSync.ts, add a listener for the
  'BACKGROUND_SYNC_TRIGGERED' message from the service worker
  and call syncQueue() when it is received.
- This ensures sync happens even when the app is in the background
  on Android Chrome, without breaking iOS Safari which falls back
  to the existing online event approach.

---

HIGH-2: Session Storage Cleared on Cold PWA Start While Offline
File: src/app/employee/EmployeeLayoutClient.tsx

When the PWA is launched cold while offline, sessionStorage is
empty (it is cleared when the browser tab/window closes). The
layout client tries sessionStorage first, finds nothing, then
tries to fetch /api/auth/me which fails because there is no
network. This causes an immediate redirect to /employee/login
where the user cannot log in offline.

Fix:

- Change the session persistence strategy for offline resilience.
- When a successful auth check returns a valid session, save it
  to BOTH sessionStorage AND localStorage with the key
  'primetek-employee-session'.
- On cold start, the checkAuth function should:
  1. Try sessionStorage first (fast path for active sessions).
  2. If sessionStorage is empty, try localStorage as a fallback
     (survives app close/reopen).
  3. If both are empty and the device is offline, redirect to login
     (user has never logged in on this device).
  4. If a session is found in localStorage and the device is offline,
     use it to render the portal without redirecting.
- On logout, clear both sessionStorage and localStorage.
- Apply the same fix to AdminLayoutClient.tsx for the admin portal.
- Note: localStorage session is only used as an offline fallback.
  When online, the server auth check always takes precedence and
  overwrites the localStorage value with fresh data.

═══════════════════════════════════════════════════════════
PHASE 3 — MEDIUM FIXES
═══════════════════════════════════════════════════════════

MEDIUM-1: Unbounded Service Worker Cache Growth
File: public/sw.js

The service worker caches navigated pages and resources dynamically
without any size or entry count limit. Over time this will hit the
browser's storage quota and cause errors.

Fix:

- Add a cache size bounding function to sw.js that runs after
  every cache.put() call for dynamic content.
- The function should:
  - Open the dynamic cache.
  - Get all keys (cache.keys()).
  - If the count exceeds 50 entries, delete the oldest entries
    (the first entries in the list, since Cache API preserves
    insertion order) until the count is at or below 50.
- Apply this bounding function only to the dynamic navigation
  cache, not to the static assets cache (/\_next/static/ assets
  are content-hashed and should be kept until the SW updates).
- Also add a cache cleanup on the SW activate event that deletes
  all cache stores whose name does not match the current
  CACHE_NAME version string.

---

MEDIUM-2: Insecure localStorage Session Access in PWAStandaloneGuard
File: src/components/pwa/PWAStandaloneGuard.tsx

The standalone guard reads user roles from localStorage
('primetek-session', 'primetek-employee-session') to determine
which portal to redirect to. This is a security concern since
localStorage is accessible to any script on the page.

Fix:

- Remove the localStorage role-reading logic from PWAStandaloneGuard.
- Instead, determine the correct redirect target by checking the
  current URL path:
  - If the standalone app was launched from /employee/ scope
    (check window.location.pathname or the manifest start_url),
    redirect to /employee/login.
  - If launched from /admin/ scope, redirect to /admin/login.
- The guard should not need to know the user's role — it only
  needs to know which portal scope the app was installed from.
- This can be determined from the manifest scope or from the
  start_url that was used when the PWA was installed.
- As a simpler approach: check if the current URL starts with
  /admin — if yes, redirect to /admin/login, otherwise redirect
  to /employee/login.

═══════════════════════════════════════════════════════════
PHASE 4 — LOW FIXES
═══════════════════════════════════════════════════════════

LOW-1: Missing iOS Splash Screen Meta Tags
File: src/app/layout.tsx
Also: src/app/admin/layout.tsx, src/app/employee/layout.tsx

Apple viewports require explicit apple-touch-startup-image link
tags for splash screens on iPhone and iPad. Without them, the
PWA shows a white flash on launch on iOS devices.

Fix:

- Add the following meta tags to the <head> in src/app/layout.tsx
  (or in the metadata export if using Next.js metadata API):
  - <meta name="apple-mobile-web-app-capable" content="yes" />
  - <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  - <meta name="apple-mobile-web-app-title" content="Primetek" />
  - <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
- For splash screens, add apple-touch-startup-image link tags
  for the most common iPhone viewport sizes:
  iPhone SE (640x1136), iPhone 8 (750x1334),
  iPhone 14 (1170x2532), iPhone 14 Pro Max (1290x2796).
- If the splash screen images do not exist yet, create placeholder
  images at the correct dimensions in public/splash/ and link them.
- Apply the apple-mobile-web-app-capable meta tag to both the
  admin and employee layout metadata exports.

---

LOW-2: Stale Sync Feedback Disappears Too Quickly
File: src/components/pwa/OfflineSyncBanner.tsx

The sync success message disappears after 5 seconds which may
not be long enough for the user to notice it, especially on mobile.

Fix:

- Increase the success state auto-dismiss timeout from 5 seconds
  to 8 seconds.
- Additionally, keep the success banner visible until the user
  performs their next action (any click or tap on the page).
- Add a window click/tap event listener when the success state
  is shown that dismisses the banner on the next user interaction.
- Clean up the event listener when the banner is dismissed or
  when the component unmounts.

═══════════════════════════════════════════════════════════
OFFLINE QUEUE TTL FIX
═══════════════════════════════════════════════════════════

QUEUE-TTL: 24-Hour TTL Expires Weekend Check-outs
File: src/lib/offline-queue.ts

The 24-hour TTL means an employee who checks out offline on Friday
evening and does not reconnect until Monday morning will have their
checkout event expire and be archived without syncing.

Fix:

- Change the TTL logic from a fixed 24-hour duration to a
  shift-boundary-aware expiry.
- Instead of expiring entries older than 24 hours, expire entries
  that are older than 3 shift boundaries from the current shift date.
- A shift boundary is midnight IST (which is 18:30 UTC of the
  previous day for the night shift).
- In practice: keep entries for up to 72 hours (3 days) to cover
  the Friday-to-Monday gap.
- Update the TTL constant from:
  const TTL = 24 _ 60 _ 60 _ 1000
  to:
  const TTL = 72 _ 60 _ 60 _ 1000
- Add a comment explaining this is intentionally 72 hours to
  cover weekend gaps in connectivity.

═══════════════════════════════════════════════════════════
RULES FOR THIS FIX SESSION
═══════════════════════════════════════════════════════════

1. Read docs/audits/PWA_OFFLINE_AUDIT_REPORT.md completely before starting.
2. Fix issues in phase order (Critical first, then High, etc.).
3. Do not change any server actions, database logic, or auth flow.
   Only change the service worker, offline queue, layout clients,
   and PWA-specific components.
4. Do not introduce new npm dependencies. Use only browser-native
   APIs (Service Worker API, Background Sync API, Cache API,
   localStorage, sessionStorage).
5. Every service worker change must increment the CACHE_NAME
   version string so the new SW activates and old caches are cleared.
6. The Background Sync fix (HIGH-1) must degrade gracefully on
   iOS Safari — never throw an error if the API is not supported.
7. The session persistence fix (HIGH-2) must not store passwords,
   tokens, or sensitive data in localStorage — only the minimal
   session object (role, name) needed to render the portal offline.
8. After all fixes, do a final check for:
   - Any fetch handler in sw.js that skips /\_next/ URLs
   - Any attendance action (startBreak, endBreak) that is called
     directly without an online check and offline queue fallback
   - Any sessionStorage-only session read that has no localStorage
     fallback for cold PWA starts
   - Any cache.put() call without a subsequent cache size bound check
   - The TTL constant in offline-queue.ts (must be 72 hours)


# PWA & OFFLINE AUDIT REPORT — 2026-05-29

### CRITICAL (offline check-in/out broken, data loss risk)
| # | File | Issue | User Impact |
|---|------|-------|-------------|
| 1 | `public/sw.template.js` (and `public/sw.js`) | **Exclusion of `_next` Caching**: The fetch interceptor explicitly skips caching for any requests containing `/_next/`. Next.js static files (JS, CSS, and dynamic route chunks) are served under `/_next/static/`. | If the network is offline or unstable during portal navigation, client-side scripts/styles for pages will fail to load, resulting in blank screens or completely unstyled/broken interfaces. |
| 2 | `src/app/employee/attendance/AttendanceClient.tsx` | **Unqueued Break Actions Offline**: The start break (`startBreak`) and end break (`endBreak`) handlers are executed as direct, unqueued mutations. | If an employee attempts to start or end a break while offline, the action will fail immediately with a network error and will be lost, leading to incorrect attendance/productive hours tracking. |

### HIGH (significant PWA functionality gaps)
| # | File | Issue | User Impact |
|---|------|-------|-------------|
| 1 | `src/hooks/useOfflineSync.ts` | **No Background Sync API Fallback**: Offline synchronization only triggers via a react hook listening to the client-side `'online'` event. | If the user closes the app or locks their device immediately after coming back online, queued check-ins or check-outs will not sync to the server until the app is manually opened again. |
| 2 | `src/app/employee/EmployeeLayoutClient.tsx` | **Session Storage Invalidation on Cold Start**: Standalone PWA relies on `sessionStorage` for user authentication state. | If the user starts the PWA cold while completely offline, `sessionStorage` may be empty (cleared on window/tab close), causing an immediate redirect to `/employee/login` where they cannot log in. |

### MEDIUM (PWA best practice violations)
| # | File | Issue | Recommendation |
|---|------|-------|----------------|
| 1 | `public/sw.template.js` | **Unbounded Cache Growth**: The service worker dynamically caches navigated pages and resources under `caches.put()` without any size or entry count limits. | Implement a cache size bounding utility in `sw.js` to keep the cache size within reasonable limits (e.g., max 50 items) to prevent storage quota warnings. |
| 2 | `src/components/pwa/PWAStandaloneGuard.tsx` | **Insecure localStorage Session Access**: The standalone guard reads user roles from `localStorage` (`primetek-session`, `primetek-employee-session`). | Deprecate storage of active session objects in persistent `localStorage` and align solely with secure, stateless HTTP-only session cookies or memory storage. |

### LOW (polish and optimization)
| # | File | Issue | Recommendation |
|---|------|-------|----------------|
| 1 | `src/app/layout.tsx` | **Missing iOS Splash Screens**: Apple viewports require explicit `<link rel="apple-touch-startup-image">` configurations. | Generate and link iOS-specific splash screen images matching the viewports of modern iPhone/iPad models. |
| 2 | `src/components/pwa/OfflineSyncBanner.tsx` | **Stale Sync Feedback Delay**: The sync success status message disappears after a hardcoded 5 seconds delay. | Keep the success state visible slightly longer or persist it in a status area until the next action is triggered. |

---

## OFFLINE QUEUE ANALYSIS
The offline queue (implemented in `src/lib/offline-queue.ts`) relies on `localStorage` to persist transactions (`check_in`, `check_out`, `wfh_request`). It implements several robust mechanisms:
- **Duplicate Prevention**: Restricts duplicate check-ins or check-outs for the same shift date.
- **Orphan Prevention**: Scans and archives check-outs that do not have a corresponding check-in parent.
- **TTL Constraint**: Enforces a 24-hour TTL after which pending items are moved to the archived failed history (`primetek_failed_attendance_history`).
- **Retry Cap**: Automatically limits sync attempts to `3`, preventing infinite retry loops against a failing server.

**Gaps Identified**:
1. **Weekend/Holiday Expiry**: The 24-hour TTL means that if an employee checks out offline on Friday evening and does not reconnect until Monday morning, their checkout event will expire and be archived without being sent to the server.
2. **Action Exclusion**: Break toggling events (`startBreak`, `endBreak`) are not queued or synchronized, rendering breaks unsupported offline.

---

## SERVICE WORKER ASSESSMENT
The service worker is compiled from `public/sw.template.js` during Next.js builds.
- **Scope**: Registered on root (`/`), covering `/employee/` and `/admin/` scopes.
- **Caching Strategy**: 
  - **Navigation (HTML)**: Network-First with fallback to cached `/employee/login` or `/admin/login` shells.
  - **Assets (JS, CSS, Images, Fonts)**: Cache-First.
- **Critical Flaws**: 
  1. The exclusion of `_next` from the fetch handler completely disables offline capabilities for all client-side Next.js compiled scripts, chunks, and dynamic styles.
  2. The service worker dynamically caches pages in `caches.open(CACHE_NAME)` but never purges old dynamic assets, creating an unbounded growth pattern.

---

## MANIFEST COMPLETENESS
The portal uses three separate web manifests:
- `public/manifest.json` (Root scope `/`)
- `public/manifest-admin.json` (Admin scope `/admin/`)
- `public/manifest-employee.json` (Employee scope `/employee/`)

Checklist of manifest fields:
- `name`: Present (`"Primetek Employee"`, `"Primetek Admin"`, `"Primetek Global Solutions"`)
- `short_name`: Present (`"Primetek"`, `"Primetek Admin"`, `"Primetek Employee"`)
- `start_url`: Present (`"/employee/login"`, `"/admin/login"`)
- `display`: Present (`"standalone"`)
- `background_color`: Present (`"#020617"`)
- `theme_color`: Present (`"#020617"`)
- `orientation`: Present (`"portrait-primary"`)
- `scope`: Present (`"/employee/"`, `"/admin/"`, `"/"`)
- `icons`: Provided in required sizes (192x192, 512x512) and configured with both `"any"` and `"maskable"` purposes.

---

## PLATFORM COMPATIBILITY
- **iOS Safari**: Requires explicit apple meta tags in layout files. Since iOS Safari does not support the Background Sync API fully, the react hook sync-on-online fallback is essential. LocalStorage is fully supported on iOS Safari to store the offline queue.
- **Android Chrome**: Fully compatible with Service Worker APIs, Background Sync, and standard PWA Install events.
- **Desktop Chrome / Edge**: Fully compatible, supports standard installation overlays.

---

## POSITIVE FINDINGS
1. **Graceful SW Updates**: The layout clients register the service worker and handle `SKIP_WAITING` messages to clean caches and trigger updates correctly without interrupting active user sessions.
2. **Scope Isolation**: Admin and Employee manifests use distinct scopes (`/admin/` and `/employee/`), which correctly isolates the standalone applications on the device home screen.
3. **PWA Standalone Guard**: The client-side guard redirects non-portal routes opened inside standalone browser frames to the correct portal login views.


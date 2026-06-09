# PWA & Offline Audit Prompt
## Primetek Global Solutions — HR Portal
## Audit #4 of 6

---

You are a senior PWA (Progressive Web App) engineer performing a deep PWA and offline capability audit of this Next.js HR portal. Your role is AUDIT ONLY — do not fix or modify any code unless explicitly told to do so. Produce a structured report of every PWA and offline issue found.

This app is a PWA used by employees to clock in/out using GPS on mobile devices. Offline capability is critical because:
- Employees may be in areas with poor connectivity
- Clock-in/out must work even when offline
- Attendance data must sync when connectivity returns
- The app is installed on employee mobile devices as a PWA

═══════════════════════════════════════════════════════════
SCOPE: FULL PWA & OFFLINE AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report:

── PWA COMPONENTS ──
src/components/pwa/AppSidebar.tsx
src/components/pwa/AppHeader.tsx
src/components/pwa/OfflineSyncBanner.tsx
src/components/pwa/PWAInstallPrompt.tsx
src/components/pwa/PWAStandaloneGuard.tsx

── LAYOUT CLIENTS (SW registration) ──
src/app/admin/AdminLayoutClient.tsx
src/app/employee/EmployeeLayoutClient.tsx

── OFFLINE QUEUE ──
src/hooks/useOfflineSync.ts
src/lib/offline-queue.ts

── ATTENDANCE (core offline feature) ──
src/app/employee/attendance/AttendanceClient.tsx
src/app/employee/attendance/actions.ts

── MANIFESTS (if they exist) ──
public/manifest-admin.json
public/manifest-employee.json

── SERVICE WORKER (if it exists) ──
public/sw.js

── APP CONFIG ──
src/app/layout.tsx
src/app/admin/layout.tsx
src/app/employee/layout.tsx
next.config.js (or next.config.ts)

═══════════════════════════════════════════════════════════
PWA AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. WEB APP MANIFEST ──
□ Does manifest-admin.json exist and is it valid?
□ Does manifest-employee.json exist and is it valid?
□ Are all required manifest fields present: name, short_name, start_url, display, icons?
□ Are icons provided in all required sizes (192x192, 512x512 minimum)?
□ Are maskable icons provided for Android adaptive icons?
□ Is the theme_color set and does it match the app's primary color?
□ Is the background_color set for the splash screen?
□ Is the display mode set to standalone or fullscreen?
□ Is the start_url correct for each portal (admin vs employee)?
□ Is the scope set correctly to prevent navigation outside the app?
□ Are shortcuts defined for quick actions (e.g., Clock In)?
□ Is the orientation set appropriately?
□ Are the manifest files linked correctly in the HTML head?

── 2. SERVICE WORKER ──
□ Does public/sw.js exist?
□ Is the service worker registered correctly in both layout clients?
□ Is the service worker scope set to '/' (covers the entire app)?
□ Does the service worker handle the install event (cache static assets)?
□ Does the service worker handle the activate event (clean old caches)?
□ Does the service worker handle the fetch event (serve cached content offline)?
□ Is the caching strategy appropriate for each resource type?
  - HTML pages: Network First (always try network, fall back to cache)
  - API routes: Network Only (never cache sensitive data)
  - Static assets (JS, CSS): Cache First (serve from cache, update in background)
  - Images: Cache First with expiry
□ Does the service worker handle background sync for offline queue?
□ Does the service worker handle push notifications?
□ Is the SKIP_WAITING message handled correctly?
□ Does the service worker update gracefully without breaking active sessions?
□ Is there a version number in the service worker for cache busting?

── 3. OFFLINE QUEUE RELIABILITY ──
□ Does the offline queue correctly persist check-in actions when offline?
□ Does the offline queue correctly persist check-out actions when offline?
□ Does the offline queue correctly persist WFH requests when offline?
□ Are break start/end actions queued when offline?
□ Are dispute submissions queued when offline?
□ Is the queue stored in localStorage (survives page refresh)?
□ Is the queue TTL (24 hours) appropriate for the shift system?
□ Is the orphaned checkout detection working correctly?
□ Is the max retry count (3) appropriate?
□ Are failed entries archived correctly?
□ Is the queue processed in the correct order (check-in before check-out)?
□ Can the queue handle the case where check-in succeeds but check-out fails?
□ Is there a UI to show the user what is in the offline queue?
□ Can the user manually dismiss failed queue entries?
□ Is the queue size bounded (no unbounded growth)?

── 4. OFFLINE DETECTION & UX ──
□ Is the online/offline status detected correctly?
□ Is the OfflineSyncBanner shown immediately when going offline?
□ Is the OfflineSyncBanner dismissed when coming back online?
□ Does the app show a clear offline indicator to the user?
□ Are actions that require network clearly disabled when offline?
□ Are actions that work offline clearly indicated?
□ Is the GPS check-in flow usable offline (GPS works without network)?
□ Does the app show the last known attendance state when offline?
□ Is the session state preserved when going offline?
□ Does the app handle the case where the user goes offline mid-action?

── 5. SYNC ON RECONNECT ──
□ Does the offline queue auto-sync when the device comes back online?
□ Is the sync triggered by the 'online' event listener?
□ Is there a manual "Sync Now" button for the user?
□ Does the sync handle conflicts (e.g., server already has a check-in)?
□ Does the sync handle the case where the server rejects an offline action?
□ Is the user notified of sync success/failure?
□ Is the sync idempotent (safe to run multiple times)?
□ Does the sync update the UI after successful sync?
□ Is there a loading state during sync?
□ Does the sync handle network errors gracefully?

── 6. INSTALL EXPERIENCE ──
□ Does PWAInstallPrompt.tsx exist and work correctly?
□ Is the install prompt shown at an appropriate time (not immediately on first visit)?
□ Is the install prompt dismissible?
□ Is the install prompt shown again after dismissal (after a delay)?
□ Does the install prompt work on iOS Safari (which has a different install flow)?
□ Does the install prompt work on Android Chrome?
□ Is there an in-app install button for users who dismissed the browser prompt?
□ Is the installed app icon correct on the home screen?
□ Does the splash screen show correctly on launch?
□ Does the app launch in standalone mode (no browser chrome)?

── 7. PWA STANDALONE GUARD ──
□ Does PWAStandaloneGuard.tsx exist and what does it do?
□ Does it correctly detect standalone mode?
□ Does it handle the case where the app is opened in a browser vs installed?
□ Is there any functionality that only works in standalone mode?
□ Is the user guided to install the app if they are using the browser?

── 8. IOS SAFARI SPECIFIC ──
□ Are apple-touch-icon meta tags present?
□ Is apple-mobile-web-app-capable set?
□ Is apple-mobile-web-app-status-bar-style set?
□ Is apple-mobile-web-app-title set?
□ Does the app handle iOS Safari's lack of full service worker support?
□ Does the offline queue work on iOS Safari (localStorage is available)?
□ Are there any iOS-specific layout issues (safe area insets)?
□ Does the GPS check-in work on iOS Safari?
□ Does the app handle iOS Safari's aggressive cache clearing?

── 9. BACKGROUND SYNC ──
□ Is the Background Sync API used for the offline queue?
□ If not, is the sync triggered reliably when the app comes back online?
□ Can the sync run when the app is in the background?
□ Is there a fallback for browsers that don't support Background Sync?
□ Is the sync triggered when the device wakes from sleep?

── 10. PUSH NOTIFICATIONS ──
□ Is push notification support implemented?
□ Are push notifications used for leave approval/rejection?
□ Are push notifications used for WFH approval/rejection?
□ Is the notification permission requested at an appropriate time?
□ Is there a fallback for users who deny notification permission?
□ Are notification payloads secure (no sensitive data in the payload)?

── 11. CACHE STRATEGY ANALYSIS ──
□ What assets are cached by the service worker?
□ Are API responses cached? (They should NOT be for sensitive data)
□ Are attendance pages cached? (They should use Network First)
□ Are static assets (JS bundles) cached with appropriate versioning?
□ Is there a risk of serving stale JS bundles after a deployment?
□ Is the cache size bounded?
□ Is there a cache cleanup strategy on service worker update?

── 12. PERFORMANCE IN STANDALONE MODE ──
□ Does the app load quickly when launched from the home screen?
□ Is the splash screen shown while the app loads?
□ Is the first meaningful paint fast in standalone mode?
□ Are there any features that are slower in standalone mode?
□ Is the GPS check-in fast enough for practical use?

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/PWA_OFFLINE_AUDIT_REPORT.md

## PWA & OFFLINE AUDIT REPORT — [Date]

### CRITICAL (offline check-in/out broken, data loss risk)
| # | File | Issue | User Impact |
|---|------|-------|-------------|

### HIGH (significant PWA functionality gaps)
| # | File | Issue | User Impact |
|---|------|-------|-------------|

### MEDIUM (PWA best practice violations)
| # | File | Issue | Recommendation |
|---|------|-------|----------------|

### LOW (polish and optimization)
| # | File | Issue | Recommendation |
|---|------|-------|----------------|

### OFFLINE QUEUE ANALYSIS
Detailed analysis of the offline queue reliability and edge cases.

### SERVICE WORKER ASSESSMENT
Assessment of the service worker caching strategy and update flow.

### MANIFEST COMPLETENESS
Checklist of manifest fields and their values.

### PLATFORM COMPATIBILITY
iOS Safari, Android Chrome, Desktop Chrome compatibility notes.

### POSITIVE FINDINGS
List what is implemented correctly from a PWA perspective.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════
- Read every file listed above before writing the report.
- If public/sw.js does not exist, note it as MISSING — this is a critical finding.
- If public/manifest-admin.json or public/manifest-employee.json do not exist, note as MISSING.
- Do not guess — only report issues you can confirm by reading the code.
- Include the exact file path for every issue.
- Do not fix anything. Audit only.
- Pay special attention to:
  - The window.location.reload() in both layout clients (infinite loop risk)
  - The SKIP_WAITING auto-activation (breaks active sessions)
  - The offline queue ordering (check-in must sync before check-out)
  - Break start/end not being queued offline
  - The 24-hour TTL (is it enough for a night shift that spans midnight?)


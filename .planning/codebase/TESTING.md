# Testing Patterns

**Analysis Date:** 2026-05-28

## Test Framework

**Runner:**
- Currently, no automated unit or integration testing runner (such as Jest, Vitest, or Playwright) is configured in the project.
- Static code analysis and verification are performed using the TypeScript compiler (`tsc`) and ESLint.

**Static Verification Commands:**
```bash
npx tsc --noEmit           # Run TypeScript compile validation to verify types
npm run lint               # Run ESLint parser to verify syntax and guidelines
npm run build              # Run Next.js production build compiler
```

## Compilation Verification

Type validation is the primary line of defense. Running `npx tsc --noEmit` checks that:
- Server Actions signatures match client parameters.
- Page Router context types match parameters (such as search parameters or slug parameters).
- Supabase Database schemas match query payload shapes.

## Manual Verification Patterns

Features are verified manually by running the application in a development container and checking the user interfaces, middleware intercepts, and database states.

### 1. Authentication & MFA Flows
- **Procedure:**
  1. Access `/admin/login` or `/employee/login`.
  2. Input valid credentials to trigger the Captcha verification check.
  3. If multi-factor authentication (MFA) is enabled, follow the redirect to the MFA validation page.
  4. Submit a TOTP token (using authenticated apps or temporary codes) to verify validation logic.
- **State Check:**
  - Verify that `admin-auth-token` or `employee-auth-token` cookies are generated with correct expiry times.
  - Check developer logs or sessionStorage updates (`primetek-admin-session`).

### 2. Geofenced Clock-In/Out
- **Procedure:**
  1. Login as an employee.
  2. Attempt to check in.
  3. Mock geographical coordinates using the browser's developer console sensors (e.g. override latitude/longitude).
  4. Verify validation returns:
     - Allow: inside the allowed workplace boundary.
     - Block: outside the allowed boundary (showing localized error banner).
- **State Check:**
  - Check the `attendance` table projections in Supabase for status updates.

### 3. Progressive Web App (PWA) & Offline Sync
- **Procedure:**
  1. Load the Employee portal.
  2. Toggle browser network to "Offline" mode.
  3. Attempt an attendance operation (e.g., Clock In, Pause, Break).
  4. Verify that the app shows the `OfflineSyncBanner` indicating the action is staged locally.
  5. Toggle browser network to "Online".
  6. Verify that `useOfflineSync` replays the request queue and persists to Supabase.
- **State Check:**
  - Check `IndexedDB` storage keys for queued requests.

### 4. Database Migrations & RPC Actions
- **Procedure:**
  - Database functions (such as `sweep_and_close_stale_sessions` or `rebuild_attendance_projection`) are checked by running raw SQL scripts or triggering them in a Postgres query window.
  - Scratch SQL scripts (e.g., `test_admin_query.js`) can be executed locally to test RPC functions via Node.js before shipping to production.

---

*Testing analysis: 2026-05-28*
*Update when automated test libraries are integrated*

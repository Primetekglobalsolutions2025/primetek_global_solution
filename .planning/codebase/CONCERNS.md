# Codebase Concerns

**Analysis Date:** 2026-05-28

## Tech Debt

**Bypassing Database Row-Level Security (RLS) via Admin Service Role Key:**
- Issue: Server-side queries in Server Actions and authentication APIs leverage `supabaseAdmin` initialized with `SUPABASE_SERVICE_ROLE_KEY`.
- Files: `src/lib/supabase-admin.ts`, and references inside `src/app/employee/attendance/actions.ts`.
- Why: Needed to manage complex event-sourced inserts and rebuild attendance projection caches that standard user tokens do not have schema authority to perform.
- Impact: Increases security blast radius. Any server action code vulnerability or parameter pollution could bypass database access restrictions.
- Fix approach: Delegate write-path updates to standard client connections calling database-level RPC functions marked as `SECURITY DEFINER`, allowing the database schema policies to dictate access without exposing service roles to the Node layer.

**Client-Side Session Caching:**
- Issue: Portals cache user roles, permissions, and session tokens inside browser `sessionStorage` (`primetek-admin-session` / `primetek-employee-session`).
- Files: `src/app/admin/AdminLayoutClient.tsx`, `src/app/employee/EmployeeLayoutClient.tsx`.
- Why: PWA support requires showing layouts and navigation menus instantly during offline states before validating auth against the server.
- Impact: If an administrative user or employee account status is updated to "Inactive" or revoked, client-side scripts could continue displaying cached layout details until the next dynamic validation or cache purge is triggered.
- Fix approach: Implement a reactive token refresh loop or bind layouts to stateful validations that automatically trigger a sessionStorage flush upon any API 401 response code.

## Known Bugs

**Offline Sync Replay Conflicts:**
- Symptoms: Attendance state sequence corruption (e.g. check-out recorded before check-in, or overlapping status sequences).
- Trigger: An employee clocks in offline on a PWA-cached mobile device, and then subsequently clocks out on a separate online desktop device before the mobile device syncs back to the server.
- Files: `src/hooks/useOfflineSync.ts`, `src/lib/offline-queue.ts`.
- Workaround: The system sweeper eventually closes stale sessions at shift boundaries, but manual admin intervention is required to repair projection states.
- Root cause: Local offline queues use timestamp sequences generated on client device time, which can drift, conflict, or lack global atomic locking.
- Fix: Introduce client device identifiers in events and validate event sequence order on the server before executing rebuilding triggers.

## Security Considerations

**Unvalidated Client Coordinates in Server Actions:**
- Risk: Geofencing is verified using latitude/longitude parameters supplied directly by client-side browser navigator calls.
- Files: `src/app/employee/attendance/actions.ts` (`checkIn`, `checkOut` functions).
- Current mitigation: Browser location spoof checks are not cryptographic; they verify coordinates against allowed IP addresses and metadata, but fake browser sensor coordinates can bypass frontend geofence boundaries.
- Recommendations: Cross-reference client coordinates against reverse-IP geolocation or ISP subnet registries to block suspicious coordinates.

**Brute Force Threshold on Captcha Verification:**
- Risk: Brute-forcing the verification CAPTCHA answer could allow an automated bot to guess the numeric answer.
- Files: `src/lib/auth.ts` (`verifyCaptchaToken` function).
- Current mitigation: Captcha verification uses cryptographic AES-GCM IV tokens containing the hashed answer and a 5-minute expiry window.
- Recommendations: Set a strict threshold (e.g., maximum 3 validation failures) on rate limiters to blacklist the IP or session key.

## Performance Bottlenecks

**Serial Rebuilding of Attendance Projections:**
- Problem: The database recalculates the full projection sequence for an employee whenever an event is recorded.
- File: `supabase/migrations/20260528100000_disable_heartbeat_sweep_and_fix_resumption.sql` (`rebuild_attendance_projection` function).
- Measurement: Takes ~100-300ms depending on database load and the number of events. Under scaling concurrency (e.g., hundreds of users checking in at the shift start), serial execution locks rows and degrades API response time.
- Cause: Recalculates all state transitions dynamically for that day.
- Improvement path: Optimize functions to only process the incremental difference of the new event, rather than recalculating the entire day's sequence from scratch.

## Fragile Areas

**Shift Boundary and Timezone Calculations:**
- File: `supabase/migrations/20260528100000_disable_heartbeat_sweep_and_fix_resumption.sql` (`sweep_and_close_stale_sessions` function).
- Why fragile: Attendance operations span midnight. Calculations hardcode time offsets (e.g., "TIME '23:00:00' AT TIME ZONE 'UTC'") to align night shift boundaries with Indian Standard Time (IST).
- Common failures: Timezone drift or changes in database server default locale can cause shifts to close prematurely or cross into incorrect dates.
- Safe modification: Encapsulate timezone conversions into a single utility helper function and utilize explicit ISO intervals.

## Scaling Limits

**Local Storage Capacity:**
- Current capacity: 5MB maximum space for localStorage in modern browsers.
- Limit: Approximately 5,000 offline events before storage is full.
- Symptoms at limit: Silent failure of offline actions or exceptions raised inside `saveQueue` in `offline-queue.ts`.
- Scaling path: Transition from localStorage to `IndexedDB` for local persistence as it provides higher storage quotas (typically hundreds of megabytes).

## Test Coverage Gaps

**Event-Sourcing Projection Recalculations:**
- What's not tested: Rebuilding projections for edge-case events (e.g., duplicate check-in, check-out before check-in, back-to-back break toggles).
- Risk: Database triggers could calculate duration fields incorrectly, leading to incorrect attendance records and payroll metrics.
- Priority: High.
- Difficulty to test: Requires setting up a local database instance to seed event streams and check results.

---

*Concerns audit: 2026-05-28*
*Update as issues are fixed or new ones discovered*

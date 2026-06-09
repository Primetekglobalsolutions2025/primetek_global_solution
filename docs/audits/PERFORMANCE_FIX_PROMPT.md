# Performance Fix Prompt
## Primetek Global Solutions — HR Portal
## Based on: docs/audits/PERFORMANCE_AUDIT_REPORT.md

---

You are a senior performance engineer.
Your task is to fix ALL issues identified in docs/audits/PERFORMANCE_AUDIT_REPORT.md.
Read that file completely before making any changes.

The audit identified that at peak load (50 employees), the system generates
1,360 DB queries in the first 5 minutes of shift start — 272 queries/minute.
The optimized target is 101 queries/minute — a 76.6% reduction.

Fix every issue in the following priority order.
Do not skip any item. Do not break any existing functionality.

═══════════════════════════════════════════════════════════
PHASE 1 — CRITICAL FIXES
═══════════════════════════════════════════════════════════

CRITICAL-1: Write-on-Read Database Contamination in SystemStatusSection
File: src/app/admin/dashboard/page.tsx
Component: SystemStatusSection

An upsert write query runs on the system_status table on every single
admin dashboard load because the section seeds default nodes inline
inside a read path. Since the dashboard is force-dynamic, this write
runs on every page load and every admin polling refresh.

Fix:
- Remove the upsert/seed logic entirely from SystemStatusSection.
- The system_status table should be seeded once via a database migration,
  not on every page render.
- Create a new migration file:
  supabase/migrations/20260529100001_seed_system_status.sql
  that inserts the 5 default nodes (Database, API Gateway, Auth System,
  Heartbeat Engine, Mail Server) using INSERT ... ON CONFLICT DO NOTHING
  so it is safe to run multiple times.
- SystemStatusSection should only SELECT from system_status, never write.
- Remove any upsert, insert, or update calls from the component.

---

CRITICAL-2: Redundant Geofence Polling Loop
File: src/app/employee/attendance/AttendanceClient.tsx
Components: sendHeartbeat useEffect, performGeofenceCheck useEffect

Two parallel geolocation polling loops run every 60 seconds.
The processHeartbeat server action already verifies the geofence
internally and returns withinRange and distance in its response.
The independent checkGeofence call is 100% redundant.

Fix:
- Remove the entire performGeofenceCheck useEffect and its
  setInterval entirely from AttendanceClient.tsx.
- Remove the checkGeofence import from the actions imports at the top.
- In the sendHeartbeat function inside the heartbeat useEffect,
  read the withinRange and distance values from the processHeartbeat
  response (res.withinRange, res.distance).
- Use those values to drive the GPS warning state (setGpsWarningSeconds,
  setGpsConfidence) that was previously driven by the geofence check loop.
- The handleVerifyLocation function (triggered by the user clicking
  "Verify Location") should keep its direct checkGeofence call since
  it is user-triggered, not a polling loop.
- The handleDismissGpsWarning function should also keep its call.
- After this fix, GPS state is updated once per heartbeat (every 60s)
  instead of twice (heartbeat + geofence check).

---

CRITICAL-3: Sequential Awaits Query Waterfall in OperationalKPIGrid
File: src/app/admin/dashboard/page.tsx
Component: OperationalKPIGrid

The component fetches 6 counts in a Promise.all but then executes
4 more count queries sequentially with await, adding 300-600ms of
unnecessary latency to every dashboard load.

Fix:
- Move all 10 count queries (the 6 in Promise.all plus the 4 sequential
  ones: idleCount, gpsCount, autoBreakCount, forceLogoutCount) into a
  single Promise.all call.
- All 10 queries are independent of each other and can run in parallel.
- The result should be a single Promise.all with 10 entries that all
  resolve simultaneously.
- Remove the 4 separate sequential await calls that come after the
  initial Promise.all.

═══════════════════════════════════════════════════════════
PHASE 2 — HIGH FIXES
═══════════════════════════════════════════════════════════

HIGH-1: Uncached Office Location Fetching
Files:
  src/lib/security/risk-engine.ts
  src/app/employee/attendance/actions.ts (checkIn, requestWFH,
    checkOut, resumeSession, endBreak, checkGeofence, processHeartbeat)

The office_locations table is queried on every heartbeat, geofence check,
check-in, check-out, break change, and risk assessment. Office location
is static data that changes only when an admin updates it in settings.
This generates thousands of unnecessary DB queries per hour.

Fix:
- Create a cached office location getter in src/lib/location.ts
  (or a new file src/lib/cache/office-location.ts).
- Use Next.js unstable_cache (from next/cache) to cache the office
  location fetch with a revalidation tag of 'office-location'.
- Set the cache TTL to 300 seconds (5 minutes).
- The cached function should fetch the active office location from
  office_locations and return { lat, lng, radius_meters, name }.
- Replace every direct supabaseAdmin.from('office_locations').select(...)
  call in attendance/actions.ts and risk-engine.ts with a call to
  this cached getter.
- In src/app/admin/settings/actions.ts saveOfficeLocation function,
  after saving the new location, call revalidateTag('office-location')
  to bust the cache immediately when the admin updates the geofence.
- This reduces office_locations queries from thousands per hour to
  at most 1 per 5 minutes (or immediately on admin update).

---

HIGH-2: Aggressive and Unconditional Admin Polling
File: src/app/admin/attendance/AttendanceClient.tsx
Component: Polling useEffect

The admin client calls router.refresh() and getRealtimeAttendanceUpdates()
every 30 seconds regardless of which tab is active. On the static 'logs'
and 'lates' tabs, this polling is completely unnecessary and generates
32 DB queries per minute per open admin tab.

Fix:
- Add a condition to both polling intervals: only poll when
  activeTab === 'live'.
- When the user switches to the 'logs' or 'lates' tab, stop both
  the updatesInterval and the routerRefreshInterval.
- When the user switches back to the 'live' tab, restart both intervals.
- Implement this by making the polling useEffect depend on activeTab
  in its dependency array, and checking activeTab === 'live' before
  starting the intervals.
- Keep the existing visibility/inactivity pause logic (document.hidden
  and 5-minute inactivity check) as it is — it is correct.
- Also keep the initial fetchRealtimeUpdates() call on mount so the
  live tab has data immediately when first opened.

---

HIGH-3: Uncached Portal Configuration Fetching
File: src/app/employee/dashboard/EmployeeDashboardServerWrapper.tsx

The portal_config table is queried on every employee dashboard load
despite the configuration being highly static (changes only when an
admin updates settings).

Fix:
- Wrap the portal_config fetch in Next.js unstable_cache with a
  revalidation tag of 'portal-config' and a TTL of 300 seconds.
- Create a cached getter getCachedPortalConfig() in a shared location
  (src/lib/cache/portal-config.ts or inline in the wrapper).
- Replace the direct supabaseAdmin.from('portal_config').select(...)
  call with the cached getter.
- In src/app/admin/settings/actions.ts saveNotificationPreferences
  and any other function that writes to portal_config, add
  revalidateTag('portal-config') after the write to bust the cache.

═══════════════════════════════════════════════════════════
PHASE 3 — MEDIUM FIXES
═══════════════════════════════════════════════════════════

MEDIUM-1: Heavy ExcelJS Library Top-Level Import
Files:
  src/app/admin/attendance/actions.ts
  src/app/admin/daily-reports/actions.ts

ExcelJS is imported at the top level of both server action files,
forcing it to be loaded into memory on every cold start and every
invocation of any action in those files, even non-export actions.

Fix:
- Remove the top-level import ExcelJS from 'exceljs' from both files.
- Inside the exportAttendanceExcel function body, replace it with:
  const ExcelJS = (await import('exceljs')).default
- Inside the exportDailyReportsExcel function body, do the same.
- This makes ExcelJS a dynamic import that is only loaded when an
  export is actually triggered, not on every action invocation.
- The TypeScript type declaration for the Worksheet interface extension
  (declare module 'exceljs') can remain at the top of the file since
  it is a type-only declaration with no runtime cost.

---

MEDIUM-2: Unpaginated Massive Attendance Fetch
File: src/app/admin/attendance/actions.ts
Function: getAdminAttendance

The query fetches up to 5,000 attendance records in a single response
with no pagination, sending a massive JSON payload on every page load
and every router.refresh() call.

Fix:
- Add page and pageSize parameters to getAdminAttendance with defaults
  of page=1 and pageSize=100.
- Apply .range((page-1)*pageSize, page*pageSize-1) to the Supabase query.
- Return { data, count, totalPages, currentPage } from the action.
- Update AttendanceClientWrapper to accept and pass page/pageSize props.
- Update AttendanceClient to display pagination controls at the bottom
  of the table (Previous / Next buttons, current page indicator).
- When the user changes the date range filter, reset to page 1.
- Keep the existing date range filter (startDate/endDate) working
  alongside pagination.

---

MEDIUM-3: 11-Query Poll Burst in getRealtimeAttendanceUpdates
File: src/app/admin/attendance/actions.ts
Function: getRealtimeAttendanceUpdates

Every 30-second poll triggers 11 separate DB queries (8 count queries,
1 event fetch, 1 employee name resolution, 1 system health select).

Fix:
- Consolidate the 8 separate count queries into a single SQL query
  using a Supabase RPC function that returns all counts in one round-trip.
- Create a new RPC function get_realtime_attendance_metrics(p_shift_date DATE)
  in a new migration file supabase/migrations/20260529100002_realtime_metrics_rpc.sql
  that returns a single row with all 8 metric counts:
  active_workforce, active_breaks, idle_warnings, gps_alerts,
  mobile_sessions, auto_breaks, pending_disputes, stale_sessions.
- Replace the 8 separate supabaseAdmin count queries in
  getRealtimeAttendanceUpdates with a single supabaseAdmin.rpc(
  'get_realtime_attendance_metrics', { p_shift_date: activeShiftDate }).
- Keep the latestEvents fetch and employee name resolution as separate
  queries since they return different data shapes.
- This reduces the poll from 11 queries to 3 queries per 30-second cycle.

═══════════════════════════════════════════════════════════
PHASE 4 — LOW FIXES
═══════════════════════════════════════════════════════════

LOW-1: Font Preloading
File: src/app/layout.tsx

Inter and Playfair Display fonts are loaded with display: swap but
without explicit preload directives, delaying first text render.

Fix:
- In the Next.js font configuration for both Inter and Playfair Display,
  add preload: true to the font options object.
- This tells Next.js to emit a <link rel="preload"> tag for the font
  files in the HTML head, reducing the time to first text render.

---

LOW-2: Blocking Navigation Badge Count in Admin Layout
File: src/app/admin/layout.tsx (or AdminLayoutClient.tsx)

The pending approvals count fetch blocks the layout shell render,
delaying the entire admin portal frame from appearing.

Fix:
- Wrap the pending count fetch in a Suspense boundary so the layout
  shell renders immediately and the badge count loads asynchronously.
- Create a small async server component PendingCountBadge that fetches
  only the count (not the full approvals data) and renders the badge.
- Wrap it in <Suspense fallback={null}> inside the sidebar or header
  where the count is displayed.
- This allows the layout chrome to appear instantly while the count
  loads in the background.

═══════════════════════════════════════════════════════════
PHASE 5 — QUERY COUNT VERIFICATION
═══════════════════════════════════════════════════════════

After all fixes are applied, the query counts should match these targets
from the audit report's optimized projections:

TARGET: Single employee check-in
- Remove the redundant office_locations query (now cached, 1 query
  serves all requests for 5 minutes).
- Remove the redundant geofence check (eliminated in CRITICAL-2).
- Target: 12 queries per check-in (down from 14).

TARGET: Admin attendance page load
- The stale sweep still runs (1 RPC).
- Attendance fetch is now paginated (100 records instead of 5,000).
- Target: 7 queries per page load (same count, but much smaller payload).

TARGET: Peak load (50 employees, first 5 minutes)
- Heartbeats: 125 heartbeats * 2 queries (no redundant geofence) = 250.
- Check-ins: 50 * 12 queries = 600.
- Admin polling: 10 realtime updates * 3 queries = 30.
- Admin router refresh: 10 * 5 queries = 50.
- Total target: ~930 queries (down from 1,360) = 31.6% reduction.
- With office location caching: further reduced since all office_locations
  queries are served from cache after the first request.

TARGET: Admin dashboard load
- All 10 KPI counts run in parallel (1 Promise.all round-trip).
- No write query on read path (system_status seeded via migration).
- Target: 16 queries (down from 17, all parallel).

═══════════════════════════════════════════════════════════
RULES FOR THIS FIX SESSION
═══════════════════════════════════════════════════════════

1. Read docs/audits/PERFORMANCE_AUDIT_REPORT.md completely before starting.
2. Fix issues in phase order (Critical first, then High, etc.).
3. Do not change any business logic, security checks, or data shapes.
   Only change how and when data is fetched.
4. Do not introduce new npm dependencies. Use only what is already
   installed (next/cache, supabase-js).
5. The office location cache (HIGH-1) is the highest-impact single fix.
   Prioritize it within Phase 2.
6. When adding unstable_cache, always pair it with a revalidateTag
   call in the corresponding write action so the cache is never stale
   after an admin update.
7. The polling fix (HIGH-2) must not break the live monitor tab.
   Verify that switching to the live tab immediately starts polling
   and switching away immediately stops it.
8. The pagination fix (MEDIUM-2) must preserve all existing filter
   functionality (date range, employee filter, status filter, search).
9. After all fixes, do a final check for:
   - Any remaining top-level import ExcelJS from 'exceljs'
   - Any direct supabaseAdmin.from('office_locations') call outside
     the cached getter
   - Any direct supabaseAdmin.from('portal_config') call outside
     the cached getter
   - Any upsert or insert call inside a read-only server component
   - Any polling interval that runs on non-live tabs
   - Any Promise.all that has sequential awaits after it for
     independent queries


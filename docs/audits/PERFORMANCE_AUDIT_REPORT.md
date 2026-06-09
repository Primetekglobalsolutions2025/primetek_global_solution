# PERFORMANCE AUDIT REPORT — May 29, 2026

### CRITICAL (causes user-visible slowness or system overload)
| # | File | Function/Component | Issue | Estimated Impact |
|---|------|--------------------|-------|-----------------|
| 1 | `src/app/admin/dashboard/page.tsx` | `SystemStatusSection` | **Write-on-Read Database Contamination**: An `upsert` write query is executed on the `system_status` table on every single render/read path to seed default nodes. Since the admin dashboard is marked as `force-dynamic`, this write query runs on every page load or client polling/refresh. | High CPU/IO write amplification, database locks under concurrent admin sessions, unnecessary write traffic on a pure read view. |
| 2 | `src/app/employee/attendance/AttendanceClient.tsx` | `sendHeartbeat` vs `performGeofenceCheck` | **Redundant Geofence Polling Loops**: The employee client runs two parallel geolocation polling loops every 60 seconds (`processHeartbeat` and `checkGeofence`). Because the `processHeartbeat` server action already verifies the geofence internally and returns `withinRange` and `distance` in its response payload, the independent `checkGeofence` call is 100% redundant. | 2x increase in GPS check network traffic and database queries per active employee at steady state. |
| 3 | `src/app/admin/dashboard/page.tsx` | `OperationalKPIGrid` | **Sequential Awaits Query Waterfall**: The section fetches 6 counts in a `Promise.all`, but subsequently executes 4 more count/select queries sequentially using `await`. This results in 5 sequential database round trips instead of parallel execution. | Adds 300ms–600ms of unnecessary TTFB/latency to the dashboard page load. |

### HIGH (significant performance waste)
| # | File | Function/Component | Issue | Estimated Impact |
|---|------|--------------------|-------|-----------------|
| 1 | `src/lib/security/risk-engine.ts`<br>`src/app/employee/attendance/actions.ts` | `assessAttendanceRisk`<br>`checkIn`<br>`requestWFH`<br>`resumeSession`<br>`endBreak`<br>`checkGeofence`<br>`processHeartbeat` | **Uncached Office Locations Fetching**: The `office_locations` table is queried from the database on every single heartbeat, geofence check, check-in, check-out, break change, and risk assessment. Since office location details are static, this is highly wasteful. | Generates thousands of unnecessary database queries per hour for active employees during shift hours. |
| 2 | `src/app/admin/attendance/AttendanceClient.tsx` | `useEffect` Polling Loop | **Aggressive and Unconditional Polling**: The admin client calls `router.refresh()` (which fetches up to 5,000 attendance records and triggers a database-level stale session sweep) and polls `getRealtimeAttendanceUpdates()` every 30 seconds, even when the admin is on the static `'logs'` or `'lates'` tabs instead of the `'live'` tab. | Generates up to 32 database queries per minute (including database writes) per open admin tab, even when idle. |
| 3 | `src/app/employee/dashboard/EmployeeDashboardServerWrapper.tsx` | `EmployeeDashboardServerWrapper` | **Uncached Portal Configuration Fetching**: The `portal_config` table is queried on every employee dashboard load, despite the configuration parameters being highly static. | Unnecessary database load on every single employee dashboard refresh. |

### MEDIUM (optimization opportunities)
| # | File | Function/Component | Issue | Recommendation |
|---|------|--------------------|-------|----------------|
| 1 | `src/app/admin/attendance/actions.ts`<br>`src/app/admin/daily-reports/actions.ts` | Top-level Imports | **Heavy Library Import in Server Actions**: The heavy `exceljs` library is imported at the top-level of the server action files, forcing it to be loaded into memory on every route invocation that references those files. | Dynamic import `exceljs` using `await import('exceljs')` inside the excel export actions to optimize memory and cold starts. |
| 2 | `src/app/admin/attendance/actions.ts` | `getAdminAttendance` | **Unpaginated Massive Fetch**: The query selects all records from the attendance table up to a hard limit of 5,000 without pagination. | Implement cursor-based pagination or date-range grouping to prevent fetching huge JSON payloads. |
| 3 | `src/app/admin/attendance/actions.ts` | `getRealtimeAttendanceUpdates` | **11-Query Poll Burst**: Polling this action triggers 11 separate query requests (including 8 count queries, 1 event fetch, 1 employee names mapping, and 1 system health select) every 30 seconds. | Consolidate the 8 count queries using a single SQL query or view, or cache metrics on a 5-second TTL. |

### LOW (minor improvements)
| # | File | Function/Component | Issue | Recommendation |
|---|------|--------------------|-------|----------------|
| 1 | `src/app/layout.tsx` | Root Font Loading | Inter and Playfair Display fonts are loaded with display: swap, but could benefit from preload directives. | Ensure preloading is active in Next.js font configuration. |
| 2 | `src/app/admin/layout.tsx` | `AdminLayout` | `getPendingCountOnly` is awaited blocking the layout shell render. | Wrap navigation badges or counts in a React Suspense boundary. |

---

### DB QUERY COUNT ANALYSIS

#### SCENARIO A: Single employee check-in
*Calculated database queries triggered by a single check-in:*
1. **Auth Verification**: SELECT status FROM `employees` (1)
2. **Session Verification**: SELECT id FROM `active_sessions` WHERE user_id = ? AND is_valid = true (1)
3. **Risk Engine - Device Check**: SELECT * FROM `device_registry` (1)
4. **Risk Engine - Active Session Check**: SELECT * FROM `active_sessions` (1)
5. **Risk Engine - GPS Verify**: SELECT lat, lng, radius_meters FROM `office_locations` (1)
6. **Risk Engine - Action Velocity Check**: SELECT created_at FROM `attendance_risk_events` (1)
7. **Risk Engine - Log Risk**: INSERT INTO `attendance_risk_events` (1)
8. **Stale Sweep**: RPC `sweep_stale_sessions_for_employee` (1)
9. **Office Verification**: SELECT lat, lng, radius_meters FROM `office_locations` (1)
10. **Duplicate Check**: SELECT id, check_out, status FROM `attendance` WHERE date = ? (1)
11. **Check-in Insert**: INSERT INTO `attendance` (1)
12. **Risk Relation Sync**: UPDATE `attendance_risk_events` SET attendance_id = ? (1)
13. **Event Stream Log**: INSERT INTO `attendance_events` (CLOCK_IN) (1)
14. **Projection Build**: RPC `rebuild_attendance_projection` (1)

**TOTAL: 14 DB Queries per check-in**

---

#### SCENARIO B: Admin attendance page load
*Calculated database queries triggered by loading `/admin/attendance`:*
1. **Auth Check**: SELECT id FROM `admin_users` (1 - cached up to 60s)
2. **Session Check**: SELECT id FROM `active_sessions` WHERE is_valid = true (1)
3. **Stale Sweep**: RPC `sweep_and_close_stale_sessions` (1 - DB write operation)
4. **Attendance Log Fetch**: SELECT * FROM `attendance` LIMIT 5000 (1)
5. **Risk Analysis Match**: SELECT * FROM `attendance_risk_events` WHERE attendance_id IN (...) (1)
6. **Live Stats Match**: SELECT * FROM `attendance_projections` WHERE session_id IN (...) (1)
7. **Employee Directory Fetch**: SELECT id, name FROM `employees` (1)

**TOTAL: 7 DB Queries per page load (5 if admin auth cache hits)**

---

#### SCENARIO C: Peak load (50 employees checking in within 15 minutes)
*Estimated database query load during the first 5 minutes of shift start:*
- **Check-ins**: 50 employees clocking in = 50 * 14 queries = **700 queries**.
- **Heartbeats**: Assuming employees check in uniformly, they spend an average of 2.5 minutes clocked in.
  - 50 employees * 2.5 heartbeats = 125 heartbeats.
  - Each heartbeat executes 3 queries (SELECT attendance, SELECT office_locations, RPC write_heartbeat_event) = 125 * 3 = **375 queries**.
- **Redundant Geofence Checks**: 125 redundant geofence checks * 1 query (SELECT office_locations) = **125 queries**.
- **Admin Polling**: 1 admin active on `/admin/attendance` (5 minutes = 10 updates and 10 refreshes).
  - 10 realtime updates * 11 queries = **110 queries**.
  - 10 router refreshes * 5 queries = **50 queries**.

**TOTAL: 1,360 DB Queries in the first 5 minutes (average 272 queries/min)**

---

#### SCENARIO D: Admin dashboard load
*Calculated database queries triggered by loading `/admin/dashboard`:*
1. **KPI Count - Working**: SELECT count FROM `attendance` (1)
2. **KPI Count - Break**: SELECT count FROM `attendance` (1)
3. **KPI Count - Mobile**: SELECT count FROM `attendance` (1)
4. **KPI Count - Leaves**: SELECT count FROM `leave_requests` (1)
5. **KPI Count - WFH**: SELECT count FROM `attendance` (1)
6. **KPI Count - Disputes**: SELECT count FROM `disputes` (1)
7. **KPI Count - Idle (Sequential)**: SELECT count FROM `attendance` (1)
8. **KPI Count - GPS Alert (Sequential)**: SELECT count FROM `attendance_events` (1)
9. **KPI Count - Auto-Breaks (Sequential)**: SELECT count FROM `attendance_events` (1)
10. **KPI Count - Force Logouts (Sequential)**: SELECT count FROM `attendance_events` (1)
11. **Activity Feed Events**: SELECT * FROM `attendance_events` LIMIT 15 (1)
12. **Activity Feed Resolution**: SELECT id, name FROM `employees` (1)
13. **Charts - Employees Total**: SELECT count FROM `employees` (1)
14. **Charts - Trends**: SELECT date, status FROM `attendance` (1)
15. **Charts - Inquiries**: SELECT created_at FROM `inquiries` (1)
16. **Operational Status - Seeding**: UPSERT INTO `system_status` (1 - DB write operation)
17. **Operational Status - Load**: SELECT * FROM `system_status` (1)

**TOTAL: 17 DB Queries (including 1 DB write query)**

---

### POLLING LOAD ANALYSIS
Steady-state DB queries per minute with $N$ active employees logged in (unoptimized vs optimized):

| Active Employees ($N$) | Unoptimized Load (QPM) | Optimized Target Load (QPM) | Reduction % |
|-----------------------|-------------------------|-----------------------------|-------------|
| 10 | $10 \times (1_{\text{heartbeat}} + 1_{\text{geofence}}) \times 4_{\text{queries}} + 32_{\text{admin}} = \mathbf{112}$ | $10 \times 1_{\text{heartbeat}} \times 2_{\text{queries}} + 1_{\text{admin}} = \mathbf{21}$ | **81.2%** |
| 50 | $50 \times (1_{\text{heartbeat}} + 1_{\text{geofence}}) \times 4_{\text{queries}} + 32_{\text{admin}} = \mathbf{432}$ | $50 \times 1_{\text{heartbeat}} \times 2_{\text{queries}} + 1_{\text{admin}} = \mathbf{101}$ | **76.6%** |
| 100 | $100 \times (1_{\text{heartbeat}} + 1_{\text{geofence}}) \times 4_{\text{queries}} + 32_{\text{admin}} = \mathbf{832}$ | $100 \times 1_{\text{heartbeat}} \times 2_{\text{queries}} + 1_{\text{admin}} = \mathbf{201}$ | **75.8%** |

*Note: Optimized target load assumes redundant geofencing is eliminated, office locations cache is active, and admin polling is restricted to tab visibility/focus.*

---

### BUNDLE SIZE CONCERNS
- `exceljs`: Loaded dynamically inside server actions, but top-level import blocks initial cold start compilation. Action files import ExcelJS at root level.
- `framer-motion`: Extensively used in `AttendanceClient.tsx` (Employee & Admin) and `AppSidebar.tsx`. Ensure Next.js custom webpack configuration tree-shakes Framer Motion.

---

### POSITIVE FINDINGS
- **Tab Leader Election**: The employee client correctly implements lease-based Leader Election using `localStorage` and `beforeunload` cleanup. Only one tab (the leader) issues heartbeat pulses, preventing an $M$-tab multi-session query storm when employees open multiple browser tabs.
- **SharedWorker Fallback**: Safe fallback to `BroadcastChannel` ensures multi-tab sync and idle tracking are supported across legacy mobile and modern desktop browsers.
- **Auth Cache**: The admin check implements a 60-second in-memory admin existence cache (`adminExistenceCache`), saving database queries on frequent auth refreshes.


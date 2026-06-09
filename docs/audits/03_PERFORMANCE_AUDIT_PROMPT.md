# Performance Audit Prompt
## Primetek Global Solutions — HR Portal
## Audit #3 of 6

---

You are a senior performance engineer performing a deep performance audit of this Next.js HR portal. Your role is AUDIT ONLY — do not fix or modify any code unless explicitly told to do so. Produce a structured report of every performance issue found.

This is a real-time attendance system where:
- Employees clock in/out multiple times per day
- Heartbeats fire every 60 seconds per active employee
- Geofence checks fire every 60 seconds per active employee
- Admin live monitor polls every 30 seconds
- The system is used simultaneously by all employees during shift hours (6:30 PM – 3:30 AM IST)
- Peak concurrent users: all employees clocking in within the first 15 minutes of shift start

═══════════════════════════════════════════════════════════
SCOPE: FULL PERFORMANCE AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report:

── LAYOUT & ROUTING ──
src/app/layout.tsx
src/app/admin/layout.tsx
src/app/admin/AdminLayoutClient.tsx
src/app/employee/layout.tsx
src/app/employee/EmployeeLayoutClient.tsx

── ADMIN PAGES ──
src/app/admin/dashboard/page.tsx
src/app/admin/attendance/page.tsx
src/app/admin/attendance/AttendanceClient.tsx
src/app/admin/attendance/AttendanceClientWrapper.tsx
src/app/admin/attendance/actions.ts
src/app/admin/approvals/page.tsx
src/app/admin/approvals/ApprovalsClient.tsx
src/app/admin/approvals/actions.ts
src/app/admin/employees/page.tsx
src/app/admin/employees/EmployeesClient.tsx
src/app/admin/employees/EmployeesClientWrapper.tsx
src/app/admin/employees/actions.ts
src/app/admin/daily-reports/DailyReportsAdminClient.tsx
src/app/admin/daily-reports/DailyReportsClientWrapper.tsx
src/app/admin/daily-reports/actions.ts
src/app/admin/audit/page.tsx

── EMPLOYEE PAGES ──
src/app/employee/dashboard/page.tsx
src/app/employee/dashboard/EmployeeDashboardServerWrapper.tsx
src/app/employee/attendance/page.tsx
src/app/employee/attendance/AttendanceClient.tsx
src/app/employee/attendance/EmployeeAttendanceServerWrapper.tsx
src/app/employee/attendance/actions.ts
src/app/employee/leaves/page.tsx
src/app/employee/leaves/LeavesClient.tsx
src/app/employee/leaves/actions.ts
src/app/employee/reports/ReportsClient.tsx
src/app/employee/reports/actions.ts

── SHARED COMPONENTS ──
src/components/pwa/AppSidebar.tsx
src/components/pwa/AppHeader.tsx
src/components/pwa/OfflineSyncBanner.tsx

── CORE LIBRARY ──
src/lib/auth.ts
src/lib/supabase-admin.ts
src/lib/security/risk-engine.ts
src/hooks/useOfflineSync.ts
src/middleware.ts

── API ROUTES ──
src/app/api/attendance/checkin/route.ts
src/app/api/attendance/checkout/route.ts
src/app/api/cron/cleanup/route.ts
src/app/api/cron/late-penalty/route.ts

═══════════════════════════════════════════════════════════
PERFORMANCE AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. SERVER COMPONENT & DATA FETCHING ──
□ Are server components fetching only the data they need (no over-fetching)?
□ Are parallel data fetches using Promise.all instead of sequential awaits?
□ Are there any waterfalls (fetch A, then fetch B with A's result, when B doesn't need A)?
□ Are Suspense boundaries placed at the right granularity (not too coarse, not too fine)?
□ Are server components correctly marked with force-dynamic only where needed?
□ Are any pages that could be statically generated being forced dynamic unnecessarily?
□ Is the admin dashboard fetching too much data in a single render?
□ Are there any server components that fetch data that is never rendered?
□ Is the EmployeeDashboardServerWrapper fetching data efficiently (5 parallel queries)?
□ Is the admin attendance page fetching projections and risk events efficiently?

── 2. CLIENT-SIDE RENDERING & RE-RENDERS ──
□ Are there any components that re-render on every parent state change unnecessarily?
□ Are expensive computations wrapped in useMemo?
□ Are callback functions wrapped in useCallback where passed as props?
□ Are there any large lists rendered without virtualization?
□ Are there any components that render the entire attendance list (500 records) at once?
□ Are filter operations on large arrays memoized?
□ Are there any state updates that trigger cascading re-renders?
□ Are there any useEffect hooks that run more often than needed?
□ Are there any components that import heavy libraries at the top level?
□ Is the framer-motion library tree-shaken correctly?

── 3. POLLING & REAL-TIME UPDATES ──
□ How many DB queries does a single heartbeat trigger?
□ How many DB queries does a single geofence check trigger?
□ How many DB queries does the admin KPI poll trigger?
□ How many DB queries does the admin router.refresh() trigger?
□ At peak (50 employees active), how many DB queries per minute does the system generate?
□ Are polling intervals appropriate (30s for admin, 60s for heartbeat)?
□ Is there any polling that runs even when the tab is hidden?
□ Is there any polling that runs even when the user is inactive?
□ Are the admin KPI poll and router.refresh() staggered to avoid simultaneous hits?
□ Does the sidebar pending count poll (every 25s) add significant DB load?
□ Is the geofence check calling checkGeofence multiple times per cycle (N+1)?
□ Are there any polling loops that are not cleaned up on component unmount?

── 4. DATABASE QUERY EFFICIENCY ──
□ Are there any N+1 query patterns in server actions?
□ Are there any queries that fetch all rows without a LIMIT?
□ Are there any queries that use SELECT * instead of selecting specific columns?
□ Are there any queries that could be combined into a single JOIN?
□ Does getAdminAttendance make 3 separate queries (attendance + risk + projections)?
□ Does the activity feed make 2 separate queries (events + employee names)?
□ Does getPendingApprovals make 3 separate queries (leaves + wfh + employees)?
□ Does getApprovalHistory make 3 separate queries (leaves + wfh + employees)?
□ Are there any queries inside loops?
□ Is the sweep_and_close_stale_sessions RPC efficient (does it lock rows)?

── 5. BUNDLE SIZE & CODE SPLITTING ──
□ Are heavy libraries (ExcelJS, framer-motion) imported at the top level of client components?
□ Is ExcelJS (a large library) imported in server actions only, or also in client components?
□ Are there any large client components that could be split into smaller chunks?
□ Are dynamic imports used for heavy components that are not needed on initial load?
□ Are there any unused imports that increase bundle size?
□ Is the lucide-react icon library imported efficiently (named imports only)?
□ Are there any polyfills being loaded unnecessarily?
□ Is the framer-motion bundle being tree-shaken?

── 6. CACHING STRATEGY ──
□ Are server components that serve static or slow-changing data using appropriate cache settings?
□ Are any pages that should be cached being forced dynamic unnecessarily?
□ Is the middleware status cache (60-second TTL) appropriate for the use case?
□ Are there any opportunities to use React cache() for deduplicating server-side fetches?
□ Is the office location fetched on every check-in (could be cached)?
□ Is the portal_config fetched on every dashboard load (could be cached)?
□ Are Supabase queries using any caching layer?
□ Is the Next.js fetch cache being used for any external API calls?

── 7. IMAGE & ASSET OPTIMIZATION ──
□ Are all images using the Next.js Image component?
□ Are avatar images sized appropriately (not loading full-size images for thumbnails)?
□ Is the Geoapify map image in settings loaded with appropriate dimensions?
□ Are there any unoptimized images (unoptimized prop set to true unnecessarily)?
□ Are SVG icons inlined or loaded as separate files?
□ Are fonts loaded with font-display: swap?
□ Are there any large CSS files that could be split?

── 8. MEMORY MANAGEMENT ──
□ Are all intervals cleared on component unmount?
□ Are all event listeners removed on component unmount?
□ Are all BroadcastChannel instances closed on component unmount?
□ Are all SharedWorker ports closed on component unmount?
□ Are there any closures that hold references to large objects?
□ Is the geofenceHistory ref bounded in size (max 5 entries)?
□ Is the offline queue bounded in size?
□ Are there any memory leaks in the tab leader election logic?
□ Are there any growing arrays or maps that are never cleared?

── 9. NETWORK EFFICIENCY ──
□ Are server actions returning only the data the client needs?
□ Are there any server actions that return entire DB records when only a few fields are needed?
□ Is the heartbeat payload size reasonable?
□ Are there any large JSON payloads being sent over the network?
□ Are API responses compressed (gzip/brotli)?
□ Are there any redundant network requests (same data fetched multiple times)?
□ Is the offline queue sync efficient (batched or sequential)?

── 10. MIDDLEWARE PERFORMANCE ──
□ Does the middleware run on every request including static assets?
□ Is the middleware matcher correctly scoped to avoid running on static files?
□ Does the middleware make DB calls on every protected route request?
□ Is the status cache in middleware effective at reducing DB calls?
□ What is the worst-case latency added by the middleware on each request?
□ Are there any synchronous operations in the middleware that block the event loop?

── 11. PEAK LOAD ANALYSIS ──
□ At shift start (6:30 PM IST), all employees clock in within 15 minutes.
  How many DB writes does each check-in trigger?
  (attendance insert + event insert + projection rebuild + risk event insert + session create)
□ What is the total DB write load during peak check-in?
□ Does the sweep_and_close_stale_sessions run during peak check-in (adding to load)?
□ Are there any operations that could be deferred to reduce peak load?
□ Is there any request queuing or backpressure mechanism?
□ Could the heartbeat interval be increased during peak load?

── 12. PERCEIVED PERFORMANCE ──
□ Are skeleton screens shown immediately before data loads?
□ Is there any layout shift when data loads (skeleton size matches content size)?
□ Are optimistic UI updates used to make mutations feel instant?
□ Is the clock-in button responsive immediately on tap?
□ Is there any jank in the live timer (1-second interval)?
□ Are page transitions smooth?
□ Is the sidebar collapse animation smooth (transition-[width])?

═══════════════════════════════════════════════════════════
QUANTITATIVE ANALYSIS REQUIRED
═══════════════════════════════════════════════════════════

For each of the following scenarios, calculate the number of DB queries generated:

SCENARIO A: Single employee check-in
- List every DB query triggered by a single checkIn() call
- Include: session verification, geofence fetch, existing record check,
  attendance insert, event insert, projection rebuild, risk event insert,
  session create/update, revalidatePath effects

SCENARIO B: Admin attendance page load
- List every DB query triggered by loading /admin/attendance
- Include: auth check, stale session sweep, attendance fetch,
  risk events fetch, projections fetch, employees list fetch

SCENARIO C: Peak load (50 employees checking in simultaneously)
- Estimate total DB queries in the first 5 minutes of shift
- Include: all check-ins + heartbeats + admin polls

SCENARIO D: Admin dashboard load
- List every DB query triggered by loading /admin/dashboard
- Include: all Suspense boundary fetches (KPI grid, charts, activity feed, system status)

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/PERFORMANCE_AUDIT_REPORT.md

## PERFORMANCE AUDIT REPORT — [Date]

### CRITICAL (causes user-visible slowness or system overload)
| # | File | Function/Component | Issue | Estimated Impact |
|---|------|--------------------|-------|-----------------|

### HIGH (significant performance waste)
| # | File | Function/Component | Issue | Estimated Impact |
|---|------|--------------------|-------|-----------------|

### MEDIUM (optimization opportunities)
| # | File | Function/Component | Issue | Recommendation |
|---|------|--------------------|-------|----------------|

### LOW (minor improvements)
| # | File | Function/Component | Issue | Recommendation |
|---|------|--------------------|-------|----------------|

### DB QUERY COUNT ANALYSIS
Results of the 4 quantitative scenarios above.

### POLLING LOAD ANALYSIS
Total DB queries per minute at steady state with N active employees.

### BUNDLE SIZE CONCERNS
List of heavy imports and their estimated impact on bundle size.

### POSITIVE FINDINGS
List what is implemented correctly from a performance perspective.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════
- Read every file listed above before writing the report.
- Do not guess — only report issues you can confirm by reading the code.
- Include the exact file path and function name for every issue.
- Do not fix anything. Audit only.
- Pay special attention to:
  - The heartbeat loop (fires every 60s per active employee)
  - The geofence check loop (fires every 60s, calls checkGeofence N times)
  - The admin polling (30s KPI + 30s router.refresh, staggered by 15s)
  - The sidebar pending count poll (every 25s)
  - The getAdminAttendance function (3 separate queries + sweep)
  - The ExcelJS import in server actions (large library)
  - The .limit(500) queries (no pagination)


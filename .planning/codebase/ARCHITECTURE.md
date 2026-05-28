# Architecture

**Analysis Date:** 2026-05-28

## Pattern Overview

**Overall:** Layered Full-stack Application with Event-Sourced Attendance Ledger.

**Key Characteristics:**
- **Event-Sourced Write Path**: Attendance states (Working, Break, Idle) are stored as an immutable sequence of events in `attendance_events`. Projections are computed deterministically from this event stream.
- **Cached Read Path**: Current active states, accumulated durations, and break times are cached in the `attendance_projections` and `attendance` tables to allow fast administrative reads.
- **Serverless Execution**: Standard web requests and Cron cleanups are run via Next.js Serverless Functions and Edge API Routes.
- **Hybrid Security Layer**: Access controls are implemented at the server side (Server Actions session checks) and backed up by PostgreSQL Row-Level Security (RLS) policies.

## Layers

**Client Layer (UI):**
- Purpose: Render dashboard statistics, listen to telemetry heartbeats (clicks, keypresses), acquire browser GPS coordinates, and handle user interactions.
- Location: `src/app/employee/attendance/AttendanceClient.tsx`
- Depends on: Server Actions Layer.
- Used by: Next.js routing.

**Server Actions Layer (Controllers):**
- Purpose: Handle secure client invocations, verify user sessions, assess geofence margins, execute security risk engine analysis, and insert ledger events.
- Location: `src/app/employee/attendance/actions.ts` & `src/app/admin/attendance/actions.ts`
- Depends on: Data Access Layer and Supabase client integrations.
- Used by: Client Layer.

**Event & Projection Layer (Database logic):**
- Purpose: Replay events sequentially to generate deterministic state projections, process triggers, and update database cache columns.
- Location: `supabase/migrations/` (stored as SQL functions `apply_event_to_projection`, `get_session_state`, and `rebuild_attendance_projection`).
- Depends on: Database tables (`attendance_events`).
- Used by: Server Actions Layer.

**Data Access Layer (Client & Database Schema):**
- Purpose: Connection management, table definitions, and row-level security (RLS) enforcement.
- Location: `@/lib/supabase-admin.ts`
- Depends on: Supabase Auth & PostgreSQL.
- Used by: Server Actions Layer and Database triggers.

## Data Flow

**Employee Clock-In Flow:**
1. **Initiation**: Employee clicks the "Clock In" button in [AttendanceClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/AttendanceClient.tsx).
2. **GPS / Device checks**: Client collects coordinates from browser Geolocation API and captures device info/fingerprint.
3. **Action Invoke**: Calls the `checkIn` server action in [actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts).
4. **Validation**: Server action checks the geofence range, runs the security risk engine (`assessAttendanceRisk`), and creates a master session row in `attendance`.
5. **Event Append**: Inserts a sequence 1 `CLOCK_IN` event into `attendance_events`.
6. **Trigger Processing**: The database trigger `trg_apply_events` automatically fires `apply_event_to_projection()`, which creates an `attendance_projections` row and caches `status = 'Working'` on the main `attendance` table.
7. **Projection Rebuild**: Server Action runs `rebuild_attendance_projection` as a final sync step and revalidates page caches.

**State Management:**
- Stateless server execution. Client state is fetched on page load from `initialRecords` and updated reactively through server action returns.
- Long-term state resides entirely in Supabase PostgreSQL tables.

## Key Abstractions

**Event Store (`attendance_events`):**
- Purpose: Stores the immutable stream of attendance actions (CLOCK_IN, BREAK_STARTED, BREAK_ENDED, FORCE_LOGOUT, etc.) to ensure auditing compliance and historical replay capability.

**Projection Engine (`rebuild_attendance_projection`):**
- Purpose: A database-level function that resets cached values and replays the events stream from sequence 1 to rebuild the projection, ensuring absolute consistency.

**Security Risk Engine (`assessAttendanceRisk`):**
- Purpose: Assesses IP coordinates, user agents, and device fingerprints to flag suspicious clock-ins.

## Entry Points

**Web Dashboard Portals:**
- Location: `src/app/employee/dashboard/page.tsx` & `src/app/admin/dashboard/page.tsx`
- Triggers: User navigates to dashboard.
- Responsibilities: Server-render layout frames and load initial context datasets.

**Database Sweeper Cron:**
- Location: `src/app/api/cron/cleanup/route.ts`
- Triggers: Inactive hourly cron scheduler.
- Responsibilities: Invokes `sweep_and_close_stale_sessions()` database function to sweep and force-logout active sessions left open past the shift boundary date limits.

## Error Handling

**Strategy:** Exception bubbling to top-level handlers.
- Database functions catch individual loop failures using `EXCEPTION WHEN OTHERS THEN RAISE WARNING` to avoid breaking bulk sweep operations.
- Server actions wrap logic in `try/catch` and map errors to standard return shapes `{ success: false, error: message }` for rendering toast messages.

---

*Architecture analysis: 2026-05-28*
*Update when major patterns change*

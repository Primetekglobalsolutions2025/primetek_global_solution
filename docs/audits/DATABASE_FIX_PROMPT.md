# Database Fix Prompt
## Primetek Global Solutions — HR Portal
## Based on: docs/audits/DATABASE_AUDIT_REPORT.md

---

You are a senior database engineer and full-stack developer.
Your task is to fix ALL issues identified in docs/audits/DATABASE_AUDIT_REPORT.md.
Read that file completely before making any changes.

This project uses Supabase (PostgreSQL). All database fixes must be
implemented as new SQL migration files in the supabase/migrations/ directory.
Application-layer fixes must be made in the corresponding TypeScript files.

Fix every issue in the following priority order.
Do not skip any item. Do not break any existing functionality.

═══════════════════════════════════════════════════════════
PHASE 1 — CRITICAL FIXES
═══════════════════════════════════════════════════════════

CRITICAL-1: Concurrency Race Condition in Projection Rebuild
Migration file to create: supabase/migrations/[timestamp]_fix_projection_rebuild_race.sql
Application file: supabase/migrations/20260528050000_simplification_and_stabilization.sql

The current rebuild_attendance_projection function uses DELETE + INSERT.
During the DELETE window, concurrent heartbeat triggers receive NOT FOUND
on the projection lookup and return early, permanently losing that event's
state change from the projection.

Fix — SQL Migration:
- Rewrite the rebuild_attendance_projection function to use
  INSERT ... ON CONFLICT (session_id) DO UPDATE instead of DELETE + INSERT.
- Before the rebuild calculation begins, acquire a row-level lock on the
  parent attendance row using SELECT ... FOR UPDATE on the attendance table
  for the given session_id. This serializes concurrent rebuild calls.
- The lock must be acquired at the very start of the function, before any
  reads or writes to attendance_projections.
- The INSERT ... ON CONFLICT DO UPDATE must update every column of the
  projection atomically in a single statement.
- After this fix, the apply_event_to_projection trigger will always find
  the projection row (it is never deleted), eliminating the race window.
- Also update the trigger function apply_event_to_projection to use
  INSERT ... ON CONFLICT DO UPDATE when initializing a new projection,
  so it is safe even if called before the first rebuild.

---

CRITICAL-2: Missing Polymorphic Foreign Key Constraints (Orphaned Records)
Migration file to create: supabase/migrations/[timestamp]_fix_orphaned_records.sql
Tables affected: audit_logs, active_sessions, trusted_devices

These tables use a plain UUID user_id column with no foreign key constraint.
Deleting an employee or admin leaves orphaned rows in all three tables.

Fix — SQL Migration:
- For active_sessions and trusted_devices: these tables reference either
  employees or admin_users. Since PostgreSQL does not support polymorphic
  foreign keys natively, implement cleanup via triggers.
- Create an AFTER DELETE trigger on the employees table that deletes all
  rows from active_sessions, trusted_devices, and attendance_risk_events
  where user_id = OLD.id.
- Create an AFTER DELETE trigger on the admin_users table that deletes all
  rows from active_sessions and trusted_devices where user_id = OLD.id.
- For audit_logs: audit logs must be retained for compliance even after
  a user is deleted. Do NOT add a foreign key or delete trigger for
  audit_logs. Instead, add a comment in the migration explaining this
  is intentional for GDPR audit trail requirements.
- For attendance_risk_events: add the employee delete trigger to also
  clean up attendance_risk_events where employee_id = OLD.id.

Fix — Application Layer:
- In src/app/admin/employees/actions.ts deleteEmployee function,
  the manual cascade cleanup already deletes from active_sessions,
  trusted_devices, and attendance_risk_events. Verify these match
  the trigger logic and keep both as defense in depth.

═══════════════════════════════════════════════════════════
PHASE 2 — HIGH FIXES
═══════════════════════════════════════════════════════════

HIGH-1: N+1 Queries in Stale Session Sweep Loop
File: src/app/employee/attendance/actions.ts
Function: closeStaleSessionsForEmployee

The function loops over stale sessions in JavaScript and executes
multiple DB queries per session (fetch last event, insert FORCE_LOGOUT,
call rebuild RPC). With 50 stale sessions this is 250+ sequential queries.

Fix — Application Layer:
- Remove the JavaScript for loop entirely.
- Replace the entire closeStaleSessionsForEmployee body with a single
  call to the existing sweep_and_close_stale_sessions RPC function,
  scoped to the specific employee.
- If the RPC does not accept an employee_id parameter, create a new
  RPC function sweep_stale_sessions_for_employee(p_employee_id UUID)
  that performs the same logic as sweep_and_close_stale_sessions but
  filtered to a single employee.

Fix — SQL Migration (if new RPC needed):
- Create supabase/migrations/[timestamp]_add_employee_sweep_rpc.sql
- The new function sweep_stale_sessions_for_employee should:
  - Accept p_employee_id UUID as parameter
  - Find all attendance rows for that employee where check_out IS NULL
    and date != current IST shift date
  - For each stale session, insert a FORCE_LOGOUT event and call
    rebuild_attendance_projection in a single transaction
  - Return the count of sessions closed

---

HIGH-2: Missing Database Transaction on createFullApplication
File: src/app/admin/applications/actions.ts
Function: createFullApplication

The application insert and profile insert are two separate queries.
A crash between them leaves an orphaned application row with no profile.

Fix — Application Layer:
- Wrap both inserts in a Supabase RPC function that executes them
  atomically in a single PostgreSQL transaction.

Fix — SQL Migration:
- Create supabase/migrations/[timestamp]_add_create_application_rpc.sql
- Create a function create_full_application(p_job_id, p_name, p_email,
  p_phone, p_experience_years, p_assigned_to, p_client_address,
  p_client_role, p_client_linkedin, p_role_category, p_education_bachelors,
  p_education_masters) that:
  - Inserts into applications and captures the new id
  - Inserts into application_profiles using the captured application id
  - Both inserts happen inside the same transaction
  - Returns the new application id and profile id
  - If either insert fails, the entire transaction rolls back automatically

- In createFullApplication in actions.ts, replace the two separate
  supabaseAdmin.from('applications').insert() and
  supabaseAdmin.from('application_profiles').insert() calls with a
  single supabaseAdmin.rpc('create_full_application', { ... }) call.
- Remove the manual rollback (delete application on profile failure)
  since the transaction handles this automatically.

---

HIGH-3: Non-Atomic Leave Status Update and Balance Deduction
File: src/app/admin/approvals/actions.ts
Function: updateLeaveStatus

The status update and balance deduction are two separate operations.
If the RPC fails and the manual revert also fails, the DB is left
in an inconsistent state (status = Approved but balance not deducted).

Fix — SQL Migration:
- Create supabase/migrations/[timestamp]_add_approve_leave_rpc.sql
- Create a function approve_leave_request(p_leave_id UUID, p_admin_id UUID)
  that in a single transaction:
  - Fetches the leave request and verifies status = 'Pending'
  - Updates leave_requests.status to 'Approved'
  - Calculates working days between start_date and end_date
  - Calls increment_used_days or directly updates leave_balances
  - Returns success: true or raises an exception on any failure
  - The entire operation rolls back automatically if any step fails

Fix — Application Layer:
- In updateLeaveStatus, replace the separate status update and
  increment_used_days RPC calls with a single call to the new
  approve_leave_request RPC.
- Remove the manual fallback (non-atomic select + update) entirely.
- Remove the manual revert logic — the transaction handles rollback.
- Keep the email notification and revalidatePath calls after the
  RPC succeeds.

═══════════════════════════════════════════════════════════
PHASE 3 — MEDIUM FIXES
═══════════════════════════════════════════════════════════

MEDIUM-1: Missing Foreign Key Constraints on attendance_events
Migration file to create: supabase/migrations/[timestamp]_fix_attendance_events_fk.sql
File referenced: supabase/migrations/20260528000000_event_sourcing.sql

The session_id and employee_id columns in attendance_events have no
foreign key constraints, allowing orphaned event insertions.

Fix — SQL Migration:
- Add a foreign key constraint on attendance_events.session_id
  referencing attendance(id) with ON DELETE CASCADE.
  This ensures events are automatically deleted when the parent
  attendance session is deleted.
- Add a foreign key constraint on attendance_events.employee_id
  referencing employees(id) with ON DELETE CASCADE.
- Note: attendance_events is a partitioned table. In PostgreSQL,
  foreign keys on partitioned tables require the constraint to be
  added to each partition individually, or use a trigger-based
  approach if the partitioning makes direct FK constraints impractical.
- If direct FK constraints are not possible due to partitioning,
  create an AFTER INSERT trigger on attendance_events that verifies
  the session_id exists in attendance and the employee_id exists in
  employees, raising an exception if either check fails.

---

MEDIUM-2: Indefinite Storage Growth for Excel Exports
File: src/app/admin/attendance/actions.ts
Function: exportAttendanceExcel
Also: src/app/admin/daily-reports/actions.ts exportDailyReportsExcel

Excel files are uploaded to the exports storage bucket and never deleted.
Over time this bucket will grow indefinitely.

Fix — Application Layer:
- After generating the signed URL in exportAttendanceExcel, add a
  cleanup step that schedules deletion of the file.
- Since Supabase Storage does not have native TTL/lifecycle policies,
  implement cleanup in the existing cron cleanup route.
- In src/app/api/cron/cleanup/route.ts, add a step that:
  - Lists all files in the exports bucket
  - Deletes any file older than 1 hour (compare file created_at
    or use the timestamp embedded in the filename)
- Apply the same cleanup logic for files in the exports bucket
  created by exportDailyReportsExcel.
- Add a comment in both export functions noting that cleanup is
  handled by the cron job.

---

MEDIUM-3: Orphaned Resumes on Profile Deletion
File: src/app/admin/client-profiles/actions.ts
Function: deleteProfile

Deleting a client profile removes the DB row but leaves the resume
file in the resumes storage bucket.

Fix — Application Layer:
- In the deleteProfile function, before or after the DB delete,
  check if the profile has a resume_url.
- If resume_url is set, extract the storage path from the URL.
- Call supabaseAdmin.storage.from('resumes').remove([path]) to
  delete the file from storage.
- Wrap the storage delete in a try/catch so a storage failure does
  not block the DB delete — log the error but continue.
- Apply the same cleanup in deleteEmployee in
  src/app/admin/employees/actions.ts if employees have avatar_url
  stored in the avatars bucket.

═══════════════════════════════════════════════════════════
PHASE 4 — LOW FIXES (indexes and query optimization)
═══════════════════════════════════════════════════════════

LOW-1: Missing Indexes on audit_logs
Migration file to create: supabase/migrations/[timestamp]_add_missing_indexes.sql

The audit_logs table has no indexes on user_id or created_at,
causing full table scans as the log grows.

Fix — SQL Migration (add to the missing indexes migration file):
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action);

---

LOW-2: Missing Indexes on profile_daily_metrics
Add to the same missing indexes migration file.

Fix — SQL Migration:
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_metrics_employee_id
  ON public.profile_daily_metrics (employee_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_metrics_report_date
  ON public.profile_daily_metrics (report_date DESC);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_metrics_employee_date
  ON public.profile_daily_metrics (employee_id, report_date DESC);

---

LOW-3: Missing Indexes on application_profiles
Add to the same missing indexes migration file.

Fix — SQL Migration:
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_profiles_assigned_to
  ON public.application_profiles (assigned_to);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_profiles_status
  ON public.application_profiles (status);

---

LOW-4: Missing Indexes on applications
Add to the same missing indexes migration file.

Fix — SQL Migration:
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_job_id
  ON public.applications (job_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_assigned_to
  ON public.applications (assigned_to);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_status
  ON public.applications (status);

---

LOW-5: Missing Indexes on interview_requests
Add to the same missing indexes migration file.

Fix — SQL Migration:
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_requests_profile_id
  ON public.interview_requests (profile_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_requests_employee_id
  ON public.interview_requests (employee_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_requests_status
  ON public.interview_requests (status);

---

LOW-6: Missing Index on disputes
Add to the same missing indexes migration file.

Fix — SQL Migration:
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_attendance_id
  ON public.disputes (attendance_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_employee_id
  ON public.disputes (employee_id);
- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_status
  ON public.disputes (status);

---

LOW-7: N+1 Batch Fetching in getAdminAttendance
File: src/app/admin/attendance/actions.ts
Function: getAdminAttendance

Attendance records, projections, and risk events are fetched in three
separate queries. These can be reduced using Supabase nested selects.

Fix — Application Layer:
- Rewrite the getAdminAttendance query to use Supabase's nested
  relationship selection to fetch attendance_projections and
  attendance_risk_events in the same query as attendance.
- The main query should select from attendance with nested selects:
  attendance_projections (session_id, last_heartbeat_at,
    productive_seconds, break_seconds)
  attendance_risk_events (risk_level, risk_score, risk_reasons)
- This reduces 3 separate round-trips to 1 single JOIN query.
- Update the data mapping code below the query to read from the
  nested objects instead of the separate projectionsMap and riskMap.

═══════════════════════════════════════════════════════════
MIGRATION FILE NAMING CONVENTION
═══════════════════════════════════════════════════════════

All new migration files must follow the existing naming pattern:
[YYYYMMDDHHmmss]_[descriptive_name].sql

Use the following timestamps for the new migrations (in order):
1. 20260529000001_fix_projection_rebuild_race.sql
2. 20260529000002_fix_orphaned_records_triggers.sql
3. 20260529000003_add_employee_sweep_rpc.sql
4. 20260529000004_add_create_application_rpc.sql
5. 20260529000005_add_approve_leave_rpc.sql
6. 20260529000006_fix_attendance_events_fk.sql
7. 20260529000007_add_missing_indexes.sql

All migrations must:
- Start with BEGIN; and end with COMMIT;
- Use CREATE OR REPLACE for functions
- Use IF NOT EXISTS for indexes and triggers
- Include a comment at the top describing what the migration does
- Be idempotent (safe to run multiple times)

═══════════════════════════════════════════════════════════
VERIFICATION STEPS
═══════════════════════════════════════════════════════════

After completing all fixes, verify the following:

1. Concurrent projection rebuild test:
   Confirm that rebuild_attendance_projection uses
   INSERT ... ON CONFLICT DO UPDATE and acquires a FOR UPDATE lock.
   There should be no DELETE statement in the function body.

2. Orphaned records test:
   Confirm that AFTER DELETE triggers exist on both employees and
   admin_users tables that clean up active_sessions and trusted_devices.

3. Stale session sweep test:
   Confirm that closeStaleSessionsForEmployee no longer contains a
   JavaScript for loop with DB calls inside it.

4. Application creation test:
   Confirm that createFullApplication calls a single RPC function
   and has no manual rollback (delete on failure) code.

5. Leave approval test:
   Confirm that updateLeaveStatus calls a single approve_leave_request
   RPC and has no manual fallback select + update code.

6. Index verification:
   Confirm that all 7 index groups listed in Phase 4 exist in the
   new migration file.

7. Storage cleanup test:
   Confirm that the cron cleanup route includes logic to delete
   files from the exports bucket older than 1 hour.

8. Profile deletion test:
   Confirm that deleteProfile attempts to delete the resume file
   from storage before or after deleting the DB row.

═══════════════════════════════════════════════════════════
RULES FOR THIS FIX SESSION
═══════════════════════════════════════════════════════════

1. Read docs/audits/DATABASE_AUDIT_REPORT.md completely before starting.
2. Fix issues in phase order (Critical first, then High, etc.).
3. All database changes must be in new migration files.
   Do not modify existing migration files.
4. All new SQL functions must use CREATE OR REPLACE FUNCTION.
5. All new indexes must use CREATE INDEX CONCURRENTLY IF NOT EXISTS
   to avoid locking tables during index creation.
6. All new triggers must use CREATE OR REPLACE TRIGGER.
7. Do not change any existing RPC function signatures that are
   already called from application code — only add new ones or
   modify internal logic.
8. Every migration file must be idempotent (safe to run twice).
9. Application-layer changes must not break any existing
   server action return types or shapes.
10. After all fixes, do a final check for:
    - Any JavaScript for loop that contains supabaseAdmin calls inside it
    - Any place where two separate DB writes happen without a transaction
      or RPC wrapper for operations that must be atomic
    - Any storage upload that has no corresponding cleanup path
    - Any DELETE + INSERT pattern in SQL functions that should be
      INSERT ... ON CONFLICT DO UPDATE


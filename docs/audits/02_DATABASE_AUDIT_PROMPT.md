# Database & Schema Audit Prompt
## Primetek Global Solutions — HR Portal
## Audit #2 of 6

---

You are a senior database engineer and data architect performing a deep database audit of this Next.js HR portal backed by Supabase (PostgreSQL). Your role is AUDIT ONLY — do not fix or modify any code unless explicitly told to do so. Produce a structured report of every database issue found.

This system stores:
- Employee records and credentials
- GPS-based attendance events (append-only event stream)
- Attendance projections (materialized view of event stream)
- Leave requests and balances
- Daily recruitment metrics
- Client profiles and application data
- Audit logs
- Risk assessment events
- Device fingerprints and active sessions

═══════════════════════════════════════════════════════════
SCOPE: FULL DATABASE AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report.
These files reveal the database schema through their queries and data shapes:

── ALL SERVER ACTIONS ──
src/app/admin/attendance/actions.ts
src/app/admin/approvals/actions.ts
src/app/admin/employees/actions.ts
src/app/admin/daily-reports/actions.ts
src/app/admin/client-profiles/actions.ts
src/app/admin/applications/actions.ts
src/app/admin/inquiries/actions.ts
src/app/admin/interview-requests/actions.ts
src/app/admin/settings/actions.ts
src/app/admin/profile/actions.ts
src/app/employee/attendance/actions.ts
src/app/employee/leaves/actions.ts
src/app/employee/daily-report/actions.ts
src/app/employee/assigned-profiles/actions.ts
src/app/employee/reports/actions.ts
src/app/employee/profile/actions.ts

── API ROUTES ──
src/app/api/attendance/checkin/route.ts
src/app/api/attendance/checkout/route.ts
src/app/api/cron/cleanup/route.ts
src/app/api/cron/late-penalty/route.ts

── CORE LIBRARY ──
src/lib/auth.ts
src/lib/audit.ts
src/lib/supabase-admin.ts
src/lib/security/risk-engine.ts

── DATA SHAPE REFERENCES ──
src/app/admin/attendance/AttendanceClient.tsx
src/app/employee/attendance/AttendanceClient.tsx
src/app/employee/reports/actions.ts

═══════════════════════════════════════════════════════════
DATABASE AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. SCHEMA INTEGRITY ──
□ Are all foreign key relationships correctly defined based on how queries join tables?
□ Are there any tables that reference other tables without a foreign key constraint?
□ Are cascade rules appropriate (ON DELETE CASCADE vs ON DELETE RESTRICT)?
□ Are there any orphaned records possible (e.g., attendance_events without a valid session_id)?
□ Are NOT NULL constraints applied to all required fields?
□ Are DEFAULT values set for fields that always have a default?
□ Are UNIQUE constraints applied where needed (e.g., employee_id, email)?
□ Are CHECK constraints used to enforce business rules at the DB level?
□ Are ENUM types used for status fields or are they plain text (risk of invalid values)?
□ Are timestamp fields using timestamptz (timezone-aware) not timestamp?

── 2. TABLE INVENTORY (inferred from queries) ──
Document every table found in the codebase with:
□ employees — what columns are used, what constraints are implied
□ attendance — what columns are used, what constraints are implied
□ attendance_events — what columns are used, event_type values seen
□ attendance_projections — what columns are used, relationship to attendance
□ attendance_risk_events — what columns are used
□ leave_requests — what columns are used
□ leave_balances — what columns are used, uniqueness constraints
□ profile_daily_metrics — what columns are used, upsert conflict key
□ application_profiles — what columns are used
□ applications — what columns are used
□ jobs — what columns are used
□ interview_requests — what columns are used
□ inquiries — what columns are used
□ disputes — what columns are used
□ audit_logs — what columns are used
□ active_sessions — what columns are used
□ trusted_devices — what columns are used
□ office_locations — what columns are used
□ portal_config — what columns are used
□ system_status — what columns are used
□ admin_users — what columns are used

── 3. INDEXING STRATEGY ──
□ Are there indexes on all foreign key columns?
□ Are there indexes on columns used in WHERE clauses in hot queries?
□ Is attendance.employee_id indexed (used in every attendance query)?
□ Is attendance.date indexed (used in every attendance query)?
□ Is attendance_events.session_id indexed (used in every event query)?
□ Is attendance_events.sequence_number indexed (used for ordering)?
□ Is attendance_events.event_type indexed (used in filter queries)?
□ Is leave_requests.employee_id indexed?
□ Is leave_requests.status indexed (used in pending approval queries)?
□ Is audit_logs.user_id indexed (used in search)?
□ Is audit_logs.created_at indexed (used for ordering)?
□ Is profile_daily_metrics.employee_id + report_date a composite index?
□ Is attendance_risk_events.employee_id indexed?
□ Are there any composite indexes that would benefit hot query patterns?
□ Are there any unused indexes that add write overhead?

── 4. EVENT SOURCING INTEGRITY ──
□ Is the attendance_events table truly append-only (no UPDATE or DELETE)?
□ Are sequence_numbers guaranteed to be monotonically increasing per session?
□ Are idempotency_keys enforced with a UNIQUE constraint?
□ Can two events with the same idempotency_key be inserted?
□ Is there a risk of sequence number gaps (if an insert fails mid-transaction)?
□ Does rebuild_attendance_projection handle all event types correctly?
□ What happens if rebuild_attendance_projection is called on a session with no events?
□ Is there a risk of the projection diverging from the event stream?
□ Are there any direct UPDATE calls on the attendance table that bypass the event stream?
□ Is the session_version in attendance_projections incremented atomically?
□ Can two concurrent rebuild calls produce an inconsistent projection?

── 5. DATA CONSISTENCY ──
□ Are there any fields that are computed in application code that should be computed in the DB?
□ Is productive_hours consistent with (session_seconds - break_seconds) / 3600?
□ Is duration_hours consistent with (check_out - check_in) in hours?
□ Can break_seconds ever exceed session_seconds (impossible state)?
□ Can productive_hours be negative?
□ Is total_break_seconds consistent with the sum of all BREAK_STARTED/BREAK_ENDED pairs?
□ Are leave balance used_days consistent with approved leave requests?
□ Is deduction_applied consistent with the late penalty calculation?
□ Are there any denormalized fields that can get out of sync?
□ Is the attendance.status field always consistent with the latest event in attendance_events?

── 6. QUERY PATTERNS & N+1 RISKS ──
□ Are there any N+1 query patterns (fetching in a loop instead of a JOIN or batch)?
□ Does getAdminAttendance fetch risk events in a separate query after the main query?
□ Does getAdminAttendance fetch projections in a separate query after the main query?
□ Does RealtimeActivityFeed fetch employee names in a separate query after events?
□ Does getPendingApprovals fetch employee names in a separate query?
□ Does getApprovalHistory fetch employee names in a separate query?
□ Are there any queries that could be combined into a single JOIN?
□ Are there any queries that fetch more columns than needed (SELECT *)?
□ Are there any queries that fetch more rows than needed (missing LIMIT)?
□ Are there any queries that run inside loops?

── 7. TRANSACTION SAFETY ──
□ Are multi-step operations (insert event + rebuild projection) wrapped in transactions?
□ Can a partial failure leave the DB in an inconsistent state?
□ Is the leave balance update atomic (RPC vs manual select+update)?
□ Is the employee creation (insert employee + insert leave_balance) atomic?
□ Is the application creation (insert application + insert profile) atomic?
□ What happens if rebuild_attendance_projection fails after an event is inserted?
□ Are there any TOCTOU (time-of-check-time-of-use) race conditions?
□ Is the dispute resolution (insert event + update dispute) atomic?

── 8. DATA TYPES & PRECISION ──
□ Are GPS coordinates stored as FLOAT or DECIMAL? (DECIMAL is more precise for coordinates)
□ Are monetary/deduction values stored as DECIMAL not FLOAT?
□ Are duration values stored as seconds (integer) or hours (float)?
□ Is productive_hours stored as FLOAT — is this causing precision loss?
□ Are timestamps stored as timestamptz (not timestamp without timezone)?
□ Are boolean fields stored as BOOLEAN (not integer 0/1 or text)?
□ Are large text fields (reasons, notes) using TEXT not VARCHAR with arbitrary limits?
□ Are employee IDs (cmk2028273) stored as TEXT or VARCHAR?

── 9. ROW LEVEL SECURITY ──
□ Is RLS enabled on all tables containing user data?
□ Are RLS policies correctly scoped (employees can only see their own records)?
□ Does the application bypass RLS using the service role key everywhere?
□ Are there any tables where RLS should be enabled but is not?
□ Are RLS policies tested for bypass vulnerabilities?
□ Is the anon key ever used to access protected tables?

── 10. STORED PROCEDURES & RPC FUNCTIONS ──
□ What RPC functions are called from the application?
  - rebuild_attendance_projection
  - sweep_and_close_stale_sessions
  - recalculate_employee_lates_safe
  - recalculate_all_employee_lates
  - increment_used_days
  - cleanup_expired_sessions
  - cleanup_old_risk_events
  - log_action
□ Are these RPC functions defined with SECURITY DEFINER or SECURITY INVOKER?
□ Can these RPC functions be called directly by the anon key?
□ Are the RPC function parameters validated inside the function?
□ Are there any SQL injection risks inside the RPC functions?
□ Do the RPC functions handle NULL inputs gracefully?
□ Are the RPC functions idempotent where they need to be?

── 11. DATA RETENTION & CLEANUP ──
□ Is there a data retention policy for attendance events?
□ Is there a data retention policy for audit logs?
□ Is there a data retention policy for risk events?
□ Is there a data retention policy for active sessions?
□ Does cleanup_expired_sessions correctly identify and remove expired sessions?
□ Does cleanup_old_risk_events correctly identify and remove old events?
□ Are exported Excel files cleaned up from storage after download?
□ Are uploaded resumes cleaned up when profiles are deleted?
□ Is there a risk of storage bucket filling up over time?

── 12. PERFORMANCE AT SCALE ──
□ What is the expected row count for attendance_events after 1 year with 50 employees?
□ Will rebuild_attendance_projection become slow as event count grows?
□ Is there a maximum event count per session that should be enforced?
□ Will the audit_logs table become a performance bottleneck?
□ Are there any full table scans in hot query paths?
□ Is the attendance query (last 30 days, all employees) efficient at scale?
□ Is the sweep_and_close_stale_sessions RPC efficient at scale?

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/DATABASE_AUDIT_REPORT.md

## DATABASE AUDIT REPORT — [Date]

### CRITICAL (data loss, corruption, or integrity violations)
| # | Table/Query | File | Issue | Impact |
|---|------------|------|-------|--------|

### HIGH (performance or consistency risks)
| # | Table/Query | File | Issue | Impact |
|---|------------|------|-------|--------|

### MEDIUM (schema improvements, missing constraints)
| # | Table/Query | File | Issue | Recommendation |
|---|------------|------|-------|----------------|

### LOW (optimization opportunities)
| # | Table/Query | File | Issue | Recommendation |
|---|------------|------|-------|----------------|

### TABLE INVENTORY
Complete list of all tables inferred from the codebase with columns, constraints, and relationships.

### MISSING INDEXES
List every column that should have an index but likely does not.

### QUERY ANALYSIS
List the top 10 most frequently executed queries and their efficiency assessment.

### EVENT SOURCING INTEGRITY ASSESSMENT
Analysis of the attendance event stream consistency.

### POSITIVE FINDINGS
List what is implemented correctly from a database perspective.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════
- Read every file listed above before writing the report.
- Infer the schema from the queries — you do not have direct DB access.
- Do not guess — only report issues you can confirm by reading the code.
- Include the exact file path and query location for every issue.
- Do not fix anything. Audit only.
- Pay special attention to:
  - The event sourcing pattern (attendance_events + rebuild_projection)
  - Race conditions in concurrent writes
  - The leave balance update (atomic vs non-atomic)
  - The profile_daily_metrics upsert conflict key
  - The attendance.status field consistency with event stream
  - Any SELECT * queries that fetch unnecessary data


# DATABASE AUDIT REPORT — May 29, 2026

This database and schema audit report identifies critical, high, medium, and low severity database issues across the Primetek Global Solutions HR Portal database structure (backed by Supabase / PostgreSQL).

---

### CRITICAL (data loss, corruption, or integrity violations)

| # | Table/Query | File | Issue | Impact |
|---|------------|------|-------|--------|
| 1 | `attendance_projections` | [20260528050000_simplification_and_stabilization.sql#L267](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/supabase/migrations/20260528050000_simplification_and_stabilization.sql#L267) | **Concurrency Race Condition in Rebuild Projection**: The rebuild function deletes the projection record (`DELETE`) before calculating the new state and re-inserting it. During this window, if a new client event is inserted, the `apply_event_to_projection` trigger receives `NOT FOUND` on projection lookup and returns without applying the event. If the event is inserted after the state calculation queried but before the insertion finishes, its state change is permanently lost. | Permanent state desynchronization between the event stream and read models under concurrent telemetry pulses. |
| 2 | `audit_logs`, `active_sessions`, `trusted_devices` | [20260501000001_audit_logs.sql#L6](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/supabase/migrations/20260501000001_audit_logs.sql#L6), [20260501082020_security_trust_engine.sql#L8](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/supabase/migrations/20260501082020_security_trust_engine.sql#L8) | **Missing Polymorphic Foreign Key Constraints**: Tables use a plain `UUID NOT NULL` field (`user_id`) to refer polymorphic records (either `admin_users` or `employees`). Because no foreign keys are defined, deleting an employee or admin user leaves active session keys, trusted device signatures, and audit logs permanently orphaned in the database. | Integrity violations, orphaned records, and GDPR compliance risks ("right to be forgotten"). |

---

### HIGH (performance or consistency risks)

| # | Table/Query | File | Issue | Impact |
|---|------------|------|-------|--------|
| 1 | `attendance_events`, `attendance` | [actions.ts#L34](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L34) | **N+1 Queries in Stale Session Sweep Loop**: Inside `closeStaleSessionsForEmployee`, the application code queries `attendance_events` and executes `rebuild_attendance_projection` inside a Javascript `for` loop over each stale session. | Severe database connection strain and latency. If 50 sessions are stale, 250 sequential queries will run, causing request timeouts. |
| 2 | `applications`, `application_profiles` | [actions.ts#L100](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/applications/actions.ts#L100) | **Lack of Database Transaction wrapping (TOCTOU)**: `createFullApplication` creates a parent record in `applications` and then a profile in `application_profiles` via separate queries. If the server crashes or the connection drops between queries, the parent record is orphaned. | Broken structural constraints and orphaned application entities. |
| 3 | `leave_balances`, `leave_requests` | [actions.ts#L72](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/approvals/actions.ts#L72) | **Non-Atomic Status Update and Balance Deduction**: When approving a leave, the status is updated, and then the balance is incremented via `increment_used_days` RPC. If the RPC fails, the code manually reverts the status update. A failure in the manual revert leaves the DB in an inconsistent state. | Leave balance deduction mismatches. |

---

### MEDIUM (schema improvements, missing constraints)

| # | Table/Query | File | Issue | Recommendation |
|---|------------|------|-------|----------------|
| 1 | `attendance_events` | [20260528000000_event_sourcing.sql#L29](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/supabase/migrations/20260528000000_event_sourcing.sql#L29) | **Missing Foreign Key Referential Constraints**: The `session_id` and `employee_id` fields do not reference `attendance(id)` or `employees(id)`. | Add foreign key constraints to prevent orphaned event insertions. |
| 2 | `exports` storage | [actions.ts#L436](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/attendance/actions.ts#L436) | **Indefinite Storage Growth for Excel Exports**: Excel sheets generated during exports are saved permanently in the storage bucket. | Implement a Supabase Storage lifecycle bucket policy or a cleanup script to purge exports older than 1 hour. |
| 3 | `resumes` storage | [actions.ts#L123](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/client-profiles/actions.ts#L123) | **Orphaned Resumes on Profile Deletion**: Deleting a client profile removes the database row but does not delete the document from the resumes storage bucket. | Add a hook to delete files from Supabase Storage when the corresponding application profile is deleted. |

---

### LOW (optimization opportunities)

| # | Table/Query | File | Issue | Recommendation |
|---|------------|------|-------|----------------|
| 1 | `getAdminAttendance` | [actions.ts#L91](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/attendance/actions.ts#L91) | **N+1 Batch Fetching instead of Joins**: Attendance records, projections, and risk events are fetched in separate batch queries. | Use Supabase's relationship selection (nested select) to compile the data in a single Postgres `JOIN` roundtrip. |
| 2 | `audit_logs` | [20260501000001_audit_logs.sql](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/supabase/migrations/20260501000001_audit_logs.sql) | **Missing Indexes on Audit Logs**: No indexes exist on `user_id` or `created_at` fields. | Add indexes on `(user_id)` and `(created_at DESC)` to optimize admin dashboard search and audit trail sorting. |

---

### TABLE INVENTORY

The following tables exist in the Primetek HR Portal database:

1. **`inquiries`**
   - **Columns**: `id` (UUID, PK), `name` (TEXT), `email` (TEXT), `phone` (TEXT), `company` (TEXT), `message` (TEXT), `status` (TEXT, check: 'new', 'in-progress', 'resolved'), `created_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
2. **`jobs`**
   - **Columns**: `id` (UUID, PK), `title` (TEXT), `department` (TEXT), `location` (TEXT), `type` (TEXT, check: 'full-time', 'contract', 'remote', 'part-time'), `description` (TEXT), `requirements` (TEXT), `salary_range` (TEXT), `is_active` (BOOLEAN), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
3. **`applications`**
   - **Columns**: `id` (UUID, PK), `job_id` (UUID, FK jobs ON DELETE CASCADE), `name` (TEXT), `email` (TEXT), `phone` (TEXT), `experience_years` (NUMERIC), `cover_letter` (TEXT), `resume_url` (TEXT), `status` (TEXT, check: 'pending', 'reviewed', 'shortlisted', 'rejected'), `assigned_to` (UUID, FK employees ON DELETE SET NULL), `created_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
4. **`application_profiles`**
   - **Columns**: `id` (UUID, PK), `application_id` (UUID, FK applications ON DELETE CASCADE), `assigned_to` (UUID, FK employees ON DELETE SET NULL), `client_name` (TEXT), `client_address` (TEXT), `client_role` (TEXT), `client_phone` (TEXT), `client_email` (TEXT), `client_linkedin` (TEXT), `education_details` (JSONB), `resume_url` (TEXT), `status` (TEXT, check: 'assigned', 'processing', 'completed', 'rejected'), `role_category` (TEXT, check: 'IT', 'Non-IT'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
5. **`employees`**
   - **Columns**: `id` (UUID, PK), `employee_id` (TEXT, UNIQUE), `name` (TEXT), `email` (TEXT, UNIQUE), `password_hash` (TEXT), `role` (TEXT, check: 'employee', 'hr'), `join_date` (DATE), `not_null` join_date, `phone` (TEXT), `status` (TEXT, check: 'Active', 'Inactive', 'On Leave'), `avatar_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
6. **`attendance`**
   - **Columns**: `id` (UUID, PK), `employee_id` (UUID, FK employees ON DELETE CASCADE), `date` (DATE), `check_in` (TIMESTAMPTZ), `check_out` (TIMESTAMPTZ), `duration_hours` (NUMERIC(4,2)), `status` (TEXT, check: 'Working', 'Idle', 'Break', 'Break (Auto)', 'Logged Out', 'Pending WFH', 'Approved WFH', 'Rejected WFH', 'Present', 'Late', 'Absent', 'Half-day'), `lat` (NUMERIC(10,6)), `lng` (NUMERIC(10,6)), `created_at` (TIMESTAMPTZ), `is_late` (BOOLEAN), `late_minutes` (INTEGER), `deduction_applied` (NUMERIC(3,1)), `current_break_start` (TIMESTAMPTZ), `total_break_seconds` (INTEGER), `productive_hours` (NUMERIC(4,2)), `late_approved` (BOOLEAN), `permission_approved` (BOOLEAN), `shift_override` (BOOLEAN), `manager_exemption` (BOOLEAN), `active_device_fingerprint` (VARCHAR(256)), `active_tab_id` (VARCHAR(256)).
   - **Constraints/Relationships**: UNIQUE(employee_id, date), RLS enabled.
7. **`office_locations`**
   - **Columns**: `id` (UUID, PK), `name` (TEXT), `lat` (NUMERIC(10,6)), `lng` (NUMERIC(10,6)), `radius_meters` (INTEGER), `is_active` (BOOLEAN), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: RLS enabled.
8. **`admin_users`**
   - **Columns**: `id` (UUID, PK, FK auth.users), `email` (TEXT), `created_at` (TIMESTAMPTZ), `role` (admin_role_type ENUM), `mfa_enabled` (BOOLEAN), `mfa_secret` (TEXT).
   - **Constraints/Relationships**: RLS enabled.
9. **`profile_daily_metrics`**
   - **Columns**: `id` (UUID, PK), `employee_id` (UUID, FK employees ON DELETE CASCADE), `profile_id` (UUID, FK application_profiles ON DELETE CASCADE), `report_date` (DATE), `applications_count` (INTEGER), `interviews_count` (INTEGER), `assessments` (INTEGER), `technical_rounds` (INTEGER), `non_technical` (INTEGER), `self_submissions` (INTEGER), `support_submissions` (INTEGER), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Constraints/Relationships**: UNIQUE(profile_id, report_date), RLS enabled.
10. **`interview_requests`**
    - **Columns**: `id` (UUID, PK), `profile_id` (UUID, FK application_profiles ON DELETE CASCADE), `employee_id` (UUID, FK employees ON DELETE CASCADE), `consultant_name` (TEXT), `consultant_phone` (TEXT), `consultant_technology` (TEXT), `client_company` (TEXT), `interview_datetime` (TIMESTAMPTZ), `interview_platform` (TEXT), `resume_type` (TEXT, check: 'original', 'updated'), `updated_resume_url` (TEXT), `jd_url` (TEXT), `status` (TEXT, check: 'pending', 'acknowledged', 'completed', 'cancelled'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
11. **`portal_config`**
    - **Columns**: `config_key` (TEXT, PK), `config_value` (TEXT), `description` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
12. **`system_status`**
    - **Columns**: `node_name` (TEXT, PK), `status` (TEXT), `color` (TEXT), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
13. **`audit_logs`**
    - **Columns**: `id` (UUID, PK), `user_id` (UUID), `user_role` (TEXT), `action` (TEXT), `entity_type` (TEXT), `entity_id` (UUID), `old_data` (JSONB), `new_data` (JSONB), `ip_address` (TEXT), `created_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
14. **`active_sessions`**
    - **Columns**: `id` (UUID, PK), `user_id` (UUID), `user_role` (TEXT), `ip_address` (TEXT), `user_agent` (TEXT), `device_fingerprint` (TEXT), `created_at` (TIMESTAMPTZ), `last_active` (TIMESTAMPTZ), `expires_at` (TIMESTAMPTZ), `is_valid` (BOOLEAN).
    - **Constraints/Relationships**: RLS enabled.
15. **`trusted_devices`**
    - **Columns**: `id` (UUID, PK), `user_id` (UUID), `device_fingerprint` (TEXT), `device_label` (TEXT), `user_agent` (TEXT), `first_seen` (TIMESTAMPTZ), `last_used` (TIMESTAMPTZ), `is_trusted` (BOOLEAN).
    - **Constraints/Relationships**: UNIQUE(user_id, device_fingerprint), RLS enabled.
16. **`attendance_risk_events`**
    - **Columns**: `id` (UUID, PK), `employee_id` (UUID), `attendance_id` (UUID), `action` (TEXT), `risk_level` (TEXT), `risk_score` (INTEGER), `risk_reasons` (JSONB), `ip_address` (TEXT), `is_office_network` (BOOLEAN), `device_fingerprint` (TEXT), `is_known_device` (BOOLEAN), `metadata` (JSONB), `created_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
17. **`leave_requests`**
    - **Columns**: `id` (UUID, PK), `employee_id` (UUID, FK employees ON DELETE CASCADE), `type` (TEXT, check: 'Casual'), `start_date` (DATE), `end_date` (DATE), `reason` (TEXT), `status` (TEXT, check: 'Pending', 'Approved', 'Rejected'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
18. **`leave_balances`**
    - **Columns**: `id` (UUID, PK), `employee_id` (UUID, FK employees ON DELETE CASCADE), `leave_type` (TEXT, check: 'Casual'), `total_days` (INTEGER), `used_days` (INTEGER), `remaining_days` (INTEGER, generated stored), `year` (INTEGER), `month` (INTEGER), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: UNIQUE(employee_id, leave_type, year, month), RLS enabled.
19. **`disputes`**
    - **Columns**: `id` (UUID, PK), `employee_id` (UUID, FK employees ON DELETE CASCADE), `attendance_id` (UUID, FK attendance ON DELETE CASCADE), `category` (dispute_category ENUM), `reason` (TEXT), `evidence_snapshot` (JSONB), `status` (dispute_status ENUM), `admin_justification` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
    - **Constraints/Relationships**: RLS enabled.
20. **`attendance_events`**
    - **Columns**: `id` (UUID), `session_id` (UUID), `employee_id` (UUID), `event_type` (attendance_event_type ENUM), `event_timestamp` (TIMESTAMPTZ), `sequence_number` (INTEGER), `idempotency_key` (VARCHAR(256)), `client_ip` (INET), `gps_lat` (NUMERIC(10,6)), `gps_lng` (NUMERIC(10,6)), `gps_accuracy` (NUMERIC(6,2)), `device_fingerprint` (VARCHAR(256)), `payload` (JSONB).
    - **Constraints/Relationships**: PRIMARY KEY (id, event_timestamp). Partitioned table.
21. **`attendance_projections`**
    - **Columns**: `session_id` (UUID, PK, FK attendance ON DELETE CASCADE), `employee_id` (UUID), `current_state` (VARCHAR(32)), `productive_seconds` (INTEGER), `break_seconds` (INTEGER), `confidence_score` (INTEGER), `last_heartbeat_at` (TIMESTAMPTZ), `last_geofence_status` (BOOLEAN), `is_stale` (BOOLEAN), `session_version` (INTEGER), `updated_at` (TIMESTAMPTZ), `device_type` (VARCHAR), `device_label` (VARCHAR).
    - **Constraints/Relationships**: RLS enabled.
22. **`immutable_audit_logs`**
    - **Columns**: `id` (UUID, PK), `created_at` (TIMESTAMPTZ), `employee_id` (UUID), `session_id` (UUID), `action_type` (VARCHAR(64)), `confidence_score` (INTEGER), `telemetry_snapshot` (JSONB), `justification_chain` (JSONB).
    - **Constraints/Relationships**: RLS enabled, Immutable update/delete blocker triggers.

---

### MISSING INDEXES

The following columns are used in filters/WHERE queries but do not have indexes:

1. **`audit_logs`**: `user_id` (critical for user search) and `created_at` (critical for sorting audit trails).
2. **`profile_daily_metrics`**: `employee_id` (daily report page filters) and `report_date`.
3. **`application_profiles`**: `assigned_to` (filtering client list assigned to employee).
4. **`applications`**: `job_id` and `assigned_to`.
5. **`interview_requests`**: `profile_id` and `employee_id`.
6. **`disputes`**: `attendance_id`.
7. **`active_sessions`**: `expires_at` (the partial index covers `is_valid = true` but a full query index would help cleanup).

---

### QUERY ANALYSIS

Here are the top most frequently executed queries and their efficiency profiles:

1. **Select Attendance Session State**:
   - `SELECT * FROM public.attendance WHERE employee_id = $1 AND date = $2`
   - *Assessment*: Extremely efficient. Uses primary key index / unique index structure.
2. **Active Sessions Revocation Check**:
   - `SELECT id FROM active_sessions WHERE user_id = $1 AND is_valid = true`
   - *Assessment*: Efficient. Uses `idx_active_sessions_user` composite index.
3. **Get Projections by Session**:
   - `SELECT * FROM attendance_projections WHERE session_id = $1`
   - *Assessment*: Extremely efficient. Primary key lookup.
4. **Retrieve Stale Sessions for Sweep**:
   - `SELECT ... FROM public.attendance a LEFT JOIN public.attendance_projections p ON p.session_id = a.id WHERE a.check_out IS NULL ...`
   - *Assessment*: Moderately efficient. Optimized by `idx_attendance_date` and `idx_attendance_is_late`.
5. **Fetch Audit Logs chronologically**:
   - `SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 50`
   - *Assessment*: Inefficient. Lacks index on `created_at`, resulting in a full table scan and sort on disk as logs scale.
6. **Daily Metrics History**:
   - `SELECT * FROM profile_daily_metrics WHERE employee_id = $1 ORDER BY report_date DESC`
   - *Assessment*: Inefficient. Lacks index on `employee_id` or `report_date`, requiring sequential scanning.

---

### EVENT SOURCING INTEGRITY ASSESSMENT

The database models telemetry as an append-only event stream in `attendance_events`, recalculating states via PL/pgSQL triggers and RPC rebuild operations. 
While the triggers correctly use locking mechanisms (`SELECT FOR UPDATE`), the rebuild projection logic is highly vulnerable to concurrent write race conditions:
*   The `rebuild_attendance_projection` function deletes the materialized projection row (`DELETE`) before calculating the new projection state.
*   If a client heartbeat arrives concurrently, the `apply_event_to_projection` trigger receives `NOT FOUND` upon trying to fetch the deleted projection.
*   This causes the trigger to return early without applying the new event, causing the event's timing changes to be lost from the newly inserted projection.

*Recommendation*: Replace `DELETE` + `INSERT` with `INSERT ... ON CONFLICT (session_id) DO UPDATE` and serialize access using a session lock (`FOR UPDATE` on `attendance` master session row).

---

### POSITIVE FINDINGS

1. **Immutable Audit Logs**: The `immutable_audit_logs` table has database-level triggers blocking updates and deletions, protecting audit trail integrity even from high-privilege service roles.
2. **Deterministic Sequence Ordering**: `write_heartbeat_event` RPC checks sequence numbers using `COALESCE(MAX(sequence_number), 0)` and skips older sequences, preventing replay attacks and out-of-order event replay issues.
3. **Atomic Used Days Increment**: `increment_used_days` modifies `used_days` using standard SQL arithmetic (`used_days = used_days + p_days`) inside a single database statement, preventing race conditions during concurrent leave approval requests.
4. **Partitioned Events**: The `attendance_events` table is partitioned by date range, which will scale well as events accumulate over time.


# Security Fix Prompt
## Primetek Global Solutions — HR Portal
## Based on: docs/audits/SECURITY_AUDIT_REPORT.md

---

You are a senior application security engineer.
Your task is to fix ALL issues identified in docs/audits/SECURITY_AUDIT_REPORT.md.
Read that file completely before making any changes.

Fix every issue in the following priority order.
Do not skip any item. Do not break any existing functionality.

═══════════════════════════════════════════════════════════
PHASE 1 — CRITICAL FIXES (fix before any deployment)
═══════════════════════════════════════════════════════════

CRITICAL-1: Unauthenticated Leave Balance Insertion
File: src/app/employee/leaves/actions.ts
Function: initializeLeaveBalance (or getLeaveBalances — wherever the insert lives)

This exported server action has no session check. Any unauthenticated
caller can invoke it with an arbitrary employeeId to insert leave balance
rows into the database.

Fix:
- Add getSession() at the top of the function.
- If session is null or session.id is missing, throw new Error('Unauthorized').
- After getting the session, enforce that the employeeId parameter being
  operated on equals session.id. An employee must only be able to initialize
  their own balance.
- If the function is a helper called internally by other actions (not meant
  to be called externally), remove the export keyword so Next.js does not
  register it as a callable server action endpoint.
- If it must remain exported for internal use, add the session check and
  ownership assertion regardless.

---

CRITICAL-2: Unauthenticated Force Logout Action
File: src/app/employee/attendance/actions.ts
Function: closeStaleSessionsForEmployee

This exported server action has no session or role check. Any unauthenticated
caller can invoke it with any employeeId to force-logout that employee and
corrupt their attendance projection.

Fix:
- This function is an internal helper, not a user-facing action.
- Remove the export keyword from closeStaleSessionsForEmployee.
- It is only called from within the same file (checkIn, requestWFH) and
  from EmployeeDashboardServerWrapper and EmployeeAttendanceServerWrapper.
- For the server wrapper files that import it, move the call to a thin
  exported wrapper that does have a session check, or pass the already-
  verified session.id from the wrapper into the function as a parameter
  instead of letting it be called externally.
- The function itself should accept employeeId as a parameter and be
  a non-exported internal helper.

---

CRITICAL-3: Unauthenticated Late Penalty Recalculation
File: src/app/admin/attendance/actions.ts
Function: recalculateEmployeeLates

This exported server action has no authorization check. Any unauthenticated
caller can invoke it with any employeeId and date to trigger the
recalculate_employee_lates_safe stored procedure.

Fix:
- Add getSession() at the top of the function.
- If session is null, throw new Error('Unauthorized').
- This function is called from admin actions (toggleExemption,
  rebuildSessionProjection, overrideDeviceValidation, updateWFHStatus,
  resolveDispute). All of those callers already verify admin role.
- Add a check: if session.role !== 'admin', throw new Error('Unauthorized').
- This ensures only authenticated admins can trigger late recalculation.

---

CRITICAL-4: BOLA on Projection Rebuild
File: src/app/employee/attendance/actions.ts
Function: rebuildSession (or whichever function rebuilds the projection
for a given sessionId without verifying ownership)

An authenticated employee can pass any sessionId belonging to another
employee and trigger a projection rebuild on their record.

Fix:
- Before calling rebuild_attendance_projection, fetch the attendance
  record for the given sessionId from the database.
- Assert that the fetched record's employee_id equals session.id.
- If they do not match, throw new Error('Unauthorized: session does not
  belong to the current user').
- Apply this ownership check to every function that accepts a sessionId
  or attendanceId parameter and operates on it without verifying ownership.

---

CRITICAL-5: BOLA on GPS Dismiss Event
File: src/app/employee/attendance/actions.ts
Function: logGPSDismissEvent

An authenticated employee can pass another employee's sessionId to log
a GPS dismiss event on their behalf, bypassing geofencing alerts.

Fix:
- Fetch the attendance record for the given sessionId.
- Assert that attendance.employee_id equals session.id.
- If they do not match, throw new Error('Unauthorized').
- Only proceed with the event insert if ownership is confirmed.

---

CRITICAL-6: BOLA on Dispute Submission
File: src/app/employee/attendance/actions.ts
Function: submitDispute

An authenticated employee can submit a dispute referencing another
employee's attendanceId, corrupting dispute tracking data.

Fix:
- Before inserting the dispute, fetch the attendance record for the
  given attendanceId.
- Assert that attendance.employee_id equals session.id.
- If they do not match, throw new Error('Unauthorized: attendance record
  does not belong to the current user').
- Only proceed with the dispute insert if ownership is confirmed.

═══════════════════════════════════════════════════════════
PHASE 2 — HIGH FIXES (fix within 24 hours)
═══════════════════════════════════════════════════════════

HIGH-1: Missing Token Revocation Check in Middleware
File: src/middleware.ts
Function: middleware (employee and API route protection sections)

After logout, the JWT cookie is cleared but the middleware only validates
the JWT signature. It does not check the active_sessions table, so a
stolen token remains valid for the full 7-day lifetime.

Fix:
- In the employee route protection section of middleware, after verifying
  the JWT signature and confirming the employee is Active, also check
  the active_sessions table to confirm at least one valid session exists
  for this user ID.
- Use the existing statusCache pattern to cache this check with the same
  60-second TTL to avoid a DB call on every request.
- If no valid active session exists in the DB for this user, redirect to
  login and clear the cookie.
- Apply the same check to the admin route protection section using the
  adminCache pattern.
- The logout route already sets is_valid = false on all active sessions,
  so this check will correctly block revoked tokens.

---

HIGH-2: Lateness Penalty Bypass via Client Clock Manipulation
File: src/app/employee/attendance/actions.ts
Functions: checkIn, requestWFH

The server accepts a client-supplied clientTimestamp. An employee can
set their system clock backward to appear on time and avoid late penalties.

Fix:
- Do not use the clientTimestamp for lateness calculation.
- Always use the server-side new Date() for determining whether a
  check-in is late.
- The clientTimestamp can still be accepted for shift date validation
  (to handle edge cases where the client and server are in different
  timezones), but the lateness calculation (isLate, lateMinutes) must
  use the server clock exclusively.
- Specifically: compute isLate and lateMinutes using now = new Date()
  (server time), not using the parsed clientTimestamp.
- The clientTimestamp should only be used to determine shiftDateStr
  for the attendance record date field, and even then only if it is
  within the allowed skew window.

---

HIGH-3: Unsigned Offline Payload Manipulation
File: src/lib/offline-queue.ts
Function: enqueueOfflineAction and the sync logic in useOfflineSync.ts

The offline queue is stored in plaintext localStorage. An attacker can
write forged entries with fake GPS coordinates and timestamps, which
the client then syncs to the server as legitimate attendance actions.

Fix:
- When enqueuing an offline action, generate an HMAC signature of the
  entry's key fields (action, timestamp, lat, lng, fingerprint) using
  a per-session secret derived from the employee's session token.
- Store the signature alongside the entry in localStorage.
- In useOfflineSync.ts, before replaying any queued entry, verify the
  HMAC signature. If the signature is invalid or missing, discard the
  entry and archive it as TAMPERED.
- The per-session secret can be derived from the employee's JWT token
  stored in the HttpOnly cookie. Since the sync runs server-side via
  server actions, the server can re-derive the expected signature and
  reject entries that do not match.
- Alternatively, as a simpler mitigation: on the server side in checkIn
  and checkOut, when a clientTimestamp is provided, compare it against
  the server time. If the difference exceeds 10 minutes, reject the
  action with an error. This limits the window for replaying old
  offline entries with manipulated timestamps.

═══════════════════════════════════════════════════════════
PHASE 3 — MEDIUM FIXES (fix within sprint)
═══════════════════════════════════════════════════════════

MEDIUM-1: Signed URL Expiration Too Long (10 Years)
Files:
  src/app/admin/client-profiles/actions.ts (uploadClientResume)
  src/app/employee/assigned-profiles/actions.ts (submitInterviewRequest)

Signed URLs for resumes and JD documents are generated with a 10-year
expiry (315360000 seconds), making them effectively permanent public links.

Fix:
- Change the signed URL expiry for resume downloads to 1 hour (3600 seconds).
- Change the signed URL expiry for JD document downloads to 1 hour (3600 seconds).
- For the interview request email attachments, attach the file content
  directly to the email (already done via the attachments array) rather
  than relying on a long-lived URL.
- For the resume_url stored in the application_profiles table, store
  only the storage path (not the signed URL). Generate a fresh signed
  URL on demand when the file needs to be accessed, using a short expiry.
- Update any code that reads resume_url and uses it directly as a link
  to instead call a server action that generates a fresh short-lived
  signed URL.

---

MEDIUM-2: Missing Input Validation on Balance Updates
File: src/app/admin/employees/actions.ts
Function: updateEmployeeBalances (or wherever balance updates are handled)

Raw numeric inputs for sick, casual, and earned leave balances are
written to the database without Zod schema validation or range checking.

Fix:
- Add a Zod schema for balance updates in src/lib/validations.ts:
  The schema must enforce that each balance value is a non-negative
  integer with a maximum of 365 (one year of days).
- Parse the incoming balance data through this schema before any DB write.
- If validation fails, return { success: false, error: 'Invalid balance values' }.
- Apply this validation to every place in the codebase where leave
  balance values are written to the database.

---

MEDIUM-3: No Database Existence Check for Admin Server Actions
Files: All server actions under src/app/admin/

Admin server actions check session.role === 'admin' but do not verify
that the admin ID still exists in the admin_users table. A deleted admin
with an active JWT can still execute admin actions.

Fix:
- Create a helper function verifyActiveAdmin(adminId: string) in
  src/lib/auth.ts that queries the admin_users table and throws
  if the admin does not exist.
- Call this helper at the top of every admin server action, after
  the existing session role check.
- Use the same caching pattern as the middleware (60-second TTL)
  to avoid a DB call on every action invocation.
- This mirrors the existing verifyActiveSession function used for
  employees.

---

MEDIUM-4: Profile Metadata Update Without Active DB Validation
File: src/app/admin/profile/actions.ts
Function: updateAdminProfile (or changePassword admin branch)

Admin profile updates bypass the database existence check, allowing
deactivated admins with active sessions to update their profile.

Fix:
- Add a call to verifyActiveAdmin(session.id) (created in MEDIUM-3)
  at the top of the admin profile update and password change functions.
- This ensures deactivated or deleted admins cannot modify their
  profile or change their password.

═══════════════════════════════════════════════════════════
PHASE 4 — LOW FIXES (hardening improvements)
═══════════════════════════════════════════════════════════

LOW-1: Missing Authorization on Non-Production Cron Endpoints
Files:
  src/app/api/cron/cleanup/route.ts
  src/app/api/cron/late-penalty/route.ts

When CRON_SECRET is not set in staging or preview environments,
the authorization check is skipped entirely.

Fix:
- Remove the conditional that skips auth when CRON_SECRET is unset.
- Make CRON_SECRET mandatory in all environments.
- If CRON_SECRET is not set, return 500 with an error message
  indicating the server is misconfigured, rather than allowing
  unauthenticated access.
- The check should be: if the CRON_SECRET env var is missing,
  log an error and return 500. If it is present but does not match
  the Authorization header, return 401.

---

LOW-2: Weak CAPTCHA Entropy
File: src/lib/auth.ts
Function: createCaptchaToken and generateCaptchaChallenge

The CAPTCHA is a simple addition of two numbers (2-9 + 2-9), giving
only 13 possible answers (4 through 18). An attacker can precompute
tokens for all 13 answers and solve any CAPTCHA programmatically.

Fix:
- Increase the CAPTCHA complexity. Use multiplication instead of
  addition, or use a combination of operations.
- Alternatively, increase the number range significantly so the
  answer space is larger (e.g., two 3-digit numbers).
- Add a server-side nonce to the CAPTCHA token that is tied to the
  specific login attempt, so precomputed tokens cannot be reused
  across different login sessions.
- The nonce should be a random value included in the encrypted
  payload and also returned to the client as a separate field.
  The client must echo the nonce back with the answer, and the
  server must verify the nonce matches.

---

LOW-3: Plaintext Device Fingerprint in localStorage
File: src/lib/security/client-fingerprint.ts
Function: getOrCreateFingerprint

Device fingerprints are stored unencrypted in localStorage where
they can be extracted via XSS.

Fix:
- Add a comment to the fingerprint storage code clearly stating
  that the fingerprint is a hint/signal only and must not be
  treated as a security control.
- In the risk engine (src/lib/security/risk-engine.ts), ensure
  the device trust signal alone cannot block a check-in. It should
  only contribute to the risk score, never be the sole reason for
  blocking an action.
- Do not store the fingerprint in a way that implies it is a
  security credential. It is a convenience signal only.

---

LOW-4: Missing Input Validation on Inquiry Status Update
File: src/app/admin/inquiries/actions.ts
Function: updateInquiryStatus

The status field is passed directly to the database without validation,
relying solely on DB check constraints.

Fix:
- Add an explicit allowlist of valid status values at the top of
  the function.
- Valid statuses should be: 'new', 'in_progress', 'resolved', 'closed'
  (or whatever values the DB constraint allows — confirm from the
  codebase context).
- If the provided status is not in the allowlist, throw an error
  before the DB call.
- This provides defense in depth alongside the DB constraint.

═══════════════════════════════════════════════════════════
PHASE 5 — AUTHENTICATION FLOW HARDENING
═══════════════════════════════════════════════════════════

These are additional hardening steps based on the Authentication
Flow Analysis section of the audit report.

AUTH-HARDEN-1: Server Action Bypass via Missing Admin DB Check
Context: Server actions bypass the middleware /api route checks.
Admin server actions verify session.role === 'admin' but do not
confirm the admin still exists in admin_users.

Fix: Covered by MEDIUM-3 (verifyActiveAdmin helper).
Ensure verifyActiveAdmin is called in every admin server action
without exception.

AUTH-HARDEN-2: 7-Day JWT Lifetime
Context: The current JWT lifetime is 7 days. For an HR system
handling payroll and attendance data, this is long.

Fix:
- Reduce the JWT lifetime to 24 hours for employee tokens.
- Reduce the JWT lifetime to 8 hours for admin tokens (one shift).
- Implement a silent token refresh mechanism: when a token is
  within 1 hour of expiry and the user is active, issue a new
  token automatically via the /api/auth/me endpoint.
- Update the /api/auth/me route to issue a refreshed token when
  the existing token has less than 1 hour remaining.

AUTH-HARDEN-3: MFA Skip Vulnerability
Context: The audit notes that an attacker could potentially skip
MFA by directly calling the post-MFA endpoint if the mfa-pending-token
is not validated correctly.

Fix:
- Verify that the /api/auth/mfa-login route checks that the
  mfa-pending-token cookie contains mfa_pending: true in its payload.
- Verify that the final session token is only issued after successful
  TOTP verification, never from the mfa-pending-token alone.
- Verify that the mfa-pending-token is deleted (set to empty with
  maxAge: 0) immediately after use, whether the MFA succeeds or fails.

═══════════════════════════════════════════════════════════
VERIFICATION STEPS
═══════════════════════════════════════════════════════════

After completing all fixes, verify the following manually:

1. Call closeStaleSessionsForEmployee without a session cookie.
   It must return Unauthorized or not be callable externally.

2. Call initializeLeaveBalance without a session cookie.
   It must return Unauthorized.

3. Call recalculateEmployeeLates without a session cookie.
   It must return Unauthorized.

4. Log in as Employee A. Try to call rebuildSession with
   Employee B's sessionId. It must return Unauthorized.

5. Log in as Employee A. Try to call logGPSDismissEvent with
   Employee B's sessionId. It must return Unauthorized.

6. Log in as Employee A. Try to call submitDispute with
   Employee B's attendanceId. It must return Unauthorized.

7. Log in as an employee. Log out. Try to access /employee/dashboard.
   It must redirect to login (token revocation check).

8. Set CRON_SECRET to empty string. Call /api/cron/cleanup.
   It must return 500 (misconfiguration), not 200.

9. Try to update leave balances with a value of -5 or 999.
   It must return a validation error.

10. Try to update inquiry status with an arbitrary string.
    It must return a validation error.

═══════════════════════════════════════════════════════════
RULES FOR THIS FIX SESSION
═══════════════════════════════════════════════════════════

1. Read docs/audits/SECURITY_AUDIT_REPORT.md completely before starting.
2. Fix issues in phase order (Critical first, then High, etc.).
3. After each phase, check that no existing functionality is broken.
4. Do not introduce new npm dependencies. Use only what is already
   installed (jose, bcryptjs, zod, supabase-js).
5. Do not change the database schema or RPC function signatures.
   Only change application code.
6. Every fix must be the minimum change needed to close the
   vulnerability. Do not refactor unrelated code.
7. For every BOLA fix, the ownership check must use a fresh DB
   query — do not rely on client-supplied data to determine ownership.
8. After all fixes, do a final search for:
   - Any exported function in a use server file that has no
     getSession() call at the top
   - Any function that accepts a sessionId or attendanceId parameter
     without verifying ownership against session.id
   - Any place where clientTimestamp is used for lateness calculation
     instead of server time
   - Any signed URL with expiry greater than 3600 seconds (1 hour)
     for user-facing file access


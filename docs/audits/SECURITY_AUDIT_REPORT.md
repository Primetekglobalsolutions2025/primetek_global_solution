# SECURITY AUDIT REPORT — May 29, 2026

### CRITICAL (exploitable vulnerabilities, fix before any deployment)
| # | File | Line/Function | Vulnerability | CVSS Category | Exploit Scenario |
|---|------|--------------|---------------|---------------|-----------------|
| 1 | [leaves/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/leaves/actions.ts#L176) | `initializeLeaveBalance` | Unauthenticated Leave Balance Insertion | CWE-284 (Broken Access Control) / BOLA | An attacker sends an HTTP POST request targeting this Server Action (by specifying its unique action ID in the `Next-Action` header) and provides any arbitrary `employeeId`, `year`, and `month`. The server will execute the action, insert a new `leave_balances` row with 1 day of Casual Leave, completely bypassing authentication and role controls. |
| 2 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L26) | `closeStaleSessionsForEmployee` | Unauthenticated Force Logout Action | CWE-284 (Broken Access Control) | Because this function is exported in a `"use server"` file, it is registered by Next.js as a callable Server Action. Since it has no `getSession()` check, any external user can trigger a `FORCE_LOGOUT` state update and projection rebuild for any employee, leading to unauthorized state alteration and potential denial of service. |
| 3 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/attendance/actions.ts#L567) | `recalculateEmployeeLates` | Unauthenticated Late Penalty Recalculation | CWE-284 (Broken Access Control) | This exported function does not perform any authorization check. An unauthenticated attacker can invoke this Server Action directly with any `employeeId` and date parameters to run the PG stored procedure `recalculate_employee_lates_safe` to modify database records and apply deductions. |
| 4 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L1145) | `rebuildSession` | Broken Object Level Authorization (BOLA) on Projection Rebuild | CWE-639 (BOLA) | An employee caller with a valid session can invoke `rebuildSession` passing any arbitrary `sessionId` belonging to another employee. The server will execute the SQL rebuild procedure, deleting and recreating the other user's attendance projections. |
| 5 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L1282) | `logGPSDismissEvent` | Broken Object Level Authorization (BOLA) on GPS Dismissal | CWE-639 (BOLA) | An employee can call this action and supply another employee's `sessionId` along with spoofed GPS coordinates. The server logs a `HEARTBEAT_RECEIVED` event with dismiss payload, allowing them to bypass geofencing alerts on behalf of another user. |
| 6 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L1318) | `submitDispute` | Broken Object Level Authorization (BOLA) on Dispute Submissions | CWE-639 (BOLA) | The server action associates the dispute with the caller's employee ID but does not verify if the caller actually owns the target `attendanceId`. A user can submit a dispute referencing another employee's attendance record, corrupting dispute tracking data. |

### HIGH (significant security risk, fix within 24 hours)
| # | File | Line/Function | Vulnerability | Risk |
|---|------|--------------|---------------|------|
| 1 | [middleware.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/middleware.ts#L96) | Middleware verification | Missing Server-Side Session Validation / Token Revocation Bypass | The logout route invalidates sessions in the database, but `middleware.ts` only verifies the JWT signature and checks if the employee is active. It does not check the `active_sessions` database table. A stolen JWT cookie remains valid for the full 7-day duration even after the user logs out. |
| 2 | [attendance/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts#L125) | `checkIn` / `requestWFH` | Lateness Penalty Bypass via Client Clock Manipulation | The server accepts a client-supplied `clientTimestamp`. The validation only checks if it is in the future (> 60 seconds) and matches the server's shift date. An employee can turn back their system clock to check in on time and avoid late penalties. |
| 3 | [offline-queue.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/lib/offline-queue.ts#L142) | `enqueueOfflineAction` | Unsigned Offline Payload Manipulation | The offline queue is stored in `localStorage` in plaintext. When online status returns, the app calls server mutations using this stored data. An attacker can write forged entries (fake coords/timestamps) into `localStorage`, which the client then syncs to the server. |

### MEDIUM (security weakness, fix within sprint)
| # | File | Line/Function | Vulnerability | Risk |
|---|------|--------------|---------------|------|
| 1 | [client-profiles/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/client-profiles/actions.ts#L214) and [assigned-profiles/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/assigned-profiles/actions.ts#L125) | `uploadClientResume` & `submitInterviewRequest` | Public Signed URL Expiration (10 Years) | Resumes and JDs uploaded generate signed URLs with an expiry of 10 years (`315360000` seconds). This exposes PII permanently and defeats the purpose of signed URLs. |
| 2 | [employees/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/employees/actions.ts#L202) | `updateEmployeeBalances` | Missing Server-Side Input Validation on Balances | The action takes raw numeric inputs for sick, casual, and earned balances and updates them without Zod schema parsing or range checking, allowing out-of-bound entries. |
| 3 | Admin Actions | Admin Server Actions | No Database Existence Check for Admin Operations | Server actions in `/admin` check `session.role === 'admin'` but do not query the database to verify if the admin ID still exists in the `admin_users` table, allowing deleted admins with active JWTs to invoke them. |
| 4 | [profile/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/profile/actions.ts#L74) | `updateAdminProfile` | Profile Metadata Update without Active DB Validation | Bypasses db status/existence checks for admins when updating metadata, allowing deactivated users with active sessions to mint new valid JWTs. |

### LOW (hardening improvements)
| # | File | Line/Function | Issue | Recommendation |
|---|------|--------------|-------|----------------|
| 1 | [cron/cleanup/route.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/api/cron/cleanup/route.ts#L10) and [cron/late-penalty/route.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/api/cron/late-penalty/route.ts#L10) | Cron auth checks | Missing Authorization on Non-Prod Environments | If `CRON_SECRET` is unset in staging/preview, the authentication check is skipped entirely, allowing anonymous users to trigger sweeps and penalty calculations. Ensure `CRON_SECRET` is mandatory in all environments. |
| 2 | [auth.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/lib/auth.ts#L81) | `createCaptchaToken` | Weak Captcha Entropy | Captcha answer is a simple mathematical sum. An attacker can precompute tokens for all possible outcomes (typically 4 through 18) to programmatically solve captcha challenges. |
| 3 | [client-fingerprint.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/lib/security/client-fingerprint.ts#L70) | `getOrCreateFingerprint` | Plaintext Device Fingerprint Storage | Fingerprints are stored unencrypted in `localStorage`, where they can be extracted via XSS. Include a server-side signature to ensure integrity. |
| 4 | [inquiries/actions.ts](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/inquiries/actions.ts#L24) | `updateInquiryStatus` | Missing Input Validation for Status | The `status` field is passed directly to the DB without input validation, relying solely on DB check constraints. |

---

### AUTHENTICATION FLOW ANALYSIS

The authentication flow utilizes custom JSON Web Tokens (JWT) signed with a server-side key (`env.JWT_SECRET`) using the `jose` library:

1. **Unified Login (`/api/auth/unified-login`)**:
   - Accepts email/employee ID and password.
   - Applies an IP/email rate limiter.
   - If the rate limit is exceeded, a mathematical CAPTCHA challenge is presented.
   - Authenticates **Admins** via Supabase Auth client (`supabaseAdmin.auth.signInWithPassword`), verifying the existence of the admin in `admin_users`.
   - Authenticates **Employees** by comparing the plaintext password with the database `password_hash` using `bcryptjs`.
   - If Multi-Factor Authentication (MFA) is enabled:
     - Sets a short-lived `mfa-pending-token` (5 minutes).
     - Returns a response indicating MFA is required.
   - If MFA is not enabled:
     - Issues a 7-day token: `admin-auth-token` (for admins) or `employee-auth-token` (for employees/hr).
     - Saves the token in an HttpOnly, Lax, Secure cookie.

2. **MFA Verification (`/api/auth/mfa-login`)**:
   - Validates the `mfa-pending-token`.
   - Fetches the user's encrypted `mfa_secret` from the DB, decrypts it, and verifies the 6-digit TOTP code.
   - On success, deletes `mfa-pending-token` and issues the final 7-day session token.

3. **Session Verification (`getSession()` & `middleware.ts`)**:
   - Middleware intercepts incoming requests.
   - Verifies the signature of the token and checks if the role corresponds to the route path.
   - To check for account revocation, the middleware queries the database for user status (using `getCachedEmployeeStatus` or `getCachedAdminExistence`).

**Gaps Identified:**
- **No Token Blacklisting / Database Sync**: Because tokens are validated statelessly by signature, and the middleware does not query the `active_sessions` database table to check if a token has been explicitly invalidated, logged-out tokens remain valid until expiration.
- **Server Action Bypass**: While the middleware protects route paths, Server Actions (POST requests to the current page route) bypass the `/api` route checks. Although the Server Actions verify role parameters, they do not check if admin users still exist in the database, meaning deleted admins can execute admin Server Actions if they possess a valid JWT.

---

### AUTHORIZATION MATRIX

| Server Action / Endpoint | Guest | Employee | HR | Admin | Authorization Check Status / Gaps |
|-------------------------|-------|----------|----|-------|-----------------------------------|
| `unified-login` / `mfa-login` | ✅ | ✅ | ✅ | ✅ | Public login endpoints. |
| `checkIn` / `checkOut` | ❌ | ✅ | ✅ | ❌ | Verified via session role checking. |
| `initializeLeaveBalance` | ✅ | ✅ | ✅ | ✅ | **CRITICAL GAP**: No authorization check. Callable by anyone. |
| `closeStaleSessionsForEmployee` | ✅ | ✅ | ✅ | ✅ | **CRITICAL GAP**: No authorization check. Callable by anyone. |
| `recalculateEmployeeLates` | ✅ | ✅ | ✅ | ✅ | **CRITICAL GAP**: No authorization check. Callable by anyone. |
| `rebuildSession` | ❌ | ✅ | ✅ | ❌ | **BOLA GAP**: Verifies session role but does not check session ownership of target ID. |
| `logGPSDismissEvent` | ❌ | ✅ | ✅ | ❌ | **BOLA GAP**: Verifies session role but does not check session ownership of target ID. |
| `submitDispute` | ❌ | ✅ | ✅ | ❌ | **BOLA GAP**: Allows associating dispute with another employee's attendance record. |
| `toggleExemption` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |
| `correctClockOutTime` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |
| `updateLeaveStatus` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |
| `updateWFHStatus` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |
| `saveOfficeLocation` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |
| `createEmployee` / `deleteEmployee` | ❌ | ❌ | ❌ | ✅ | Verified via admin session role checking. |

---

### DATA EXPOSURE INVENTORY

| Sensitive Field | Table / Location | Exposure Level | Protection Status | Gaps / Vulnerability |
|-----------------|------------------|----------------|-------------------|----------------------|
| `password_hash` | `employees` table | Database only | Bcrypt hashed (12 cost factor) | None. Never returned in API responses or JWT payload. |
| `mfa_secret` | `employees` / `admin_users` | Database only | Encrypted at rest via `encryptSecret` | None. Setup/verification API decrypts it transiently. |
| GPS Coordinates (`lat`, `lng`) | `attendance` table | Database & Client | Transmitted to client page component | Plaintext transmission; spoofable via offline queue localStorage tampering. |
| Employee PII (Email, Phone, Name) | `employees` table | API `/api/auth/me` | Restricted to authenticated users | None; only returns minimum required fields. |
| Client Resumes & Job Descriptions | Supabase Storage `resumes` bucket | URL | Private storage bucket; accessed via Signed URLs | **HIGH GAP**: Signed URL duration is 10 years, rendering them virtually permanent and public. |

---

### POSITIVE SECURITY FINDINGS

1. **Magic Bytes Validation**: File upload actions verify document headers dynamically (`25504446` for PDF, `504B0304` for DOCX, `D0CF11E0` for DOC, and `89504E47` for PNG). This prevents attackers from bypassing extension filters to upload executable payloads.
2. **CSRF Validation in Route Handlers**: Mutation endpoints under `/api` validate Origin and Referer headers against the host header in `middleware.ts`.
3. **Fail-Closed Caching**: In `middleware.ts`, if the database is unavailable when validating a user's status, the middleware throws an error and redirects to the login screen instead of defaulting to access granted.
4. **No Raw SQL Construction**: The application relies on Supabase's typed query builder, mitigating SQL injection hazards.
5. **No Hardcoded Secrets**: Key variables (like `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) are dynamically resolved from environment variables.


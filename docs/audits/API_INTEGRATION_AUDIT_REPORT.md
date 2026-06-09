# API & INTEGRATION AUDIT REPORT — 2026-05-29

This report provides a detailed security, design, and consistency audit of the API endpoints, Server Actions, and external integrations in the Primetek HR Portal.

---

### CRITICAL (broken integrations, data loss, security gaps)

No critical security gaps, database connection leaks, or broken integrations were identified. The core API design correctly prevents path-traversal attacks, validates files via magic-byte headers, and enforces server-side geofence boundaries.

---

### HIGH (significant reliability or security risks)

| # | File | Route/Function | Issue | Impact |
|---|------|---------------|-------|--------|
| 1 | `src/app/api/attendance/checkin/route.ts` <br> `src/app/api/attendance/checkout/route.ts` | `POST` | **No Transaction Rate Limiting**: The check-in and check-out routes do not import or use any rate limiting, unlike public login/inquiry routes. | Compromised session tokens can be used to spam the attendance database with rapid event updates, bypassing geofences by script-looping coordinates. |
| 2 | `src/app/employee/leaves/actions.ts` | `applyForLeave` | **Server Action Exception Throwing**: Server actions throw standard JavaScript `Error` exceptions for validations (e.g., weekend blocks, overlapping dates) instead of returning `{ success: false, error: string }`. | Triggers uncaught promise rejections on the client. Next.js wraps thrown server action errors in a generic "An error occurred on the server" message in production, masking the actual validation message. |

---

### MEDIUM (consistency and reliability improvements)

| # | File | Route/Function | Issue | Recommendation |
|---|------|---------------|-------|----------------|
| 1 | `src/app/admin/client-profiles/actions.ts` | `createProfile` <br> `updateProfile` | **Silent Email Failures Swallowed**: The return status of `sendNotificationEmail` is not inspected. If Resend fails (e.g., network error or invalid email), the action still returns `{ success: true }` without logging the failure or notifying the admin. | Check the return status of `sendNotificationEmail` and log a warning to the audit trail if notifications are enabled but failed to deliver. |
| 2 | `src/app/api/admin/employees/[id]/balances/route.ts` | `GET` <br> `POST` | **Missing UUID/Path Parameter Validation**: The endpoint extracts the `id` parameter and uses it directly in database queries without verifying if it is a valid UUID string format. | A malformed or non-UUID parameter causes Postgres to throw a syntax error, resulting in a `500 Internal Server Error` instead of a `400 Bad Request`. |
| 3 | `src/app/api/attendance/checkin/route.ts` <br> `src/app/api/attendance/checkout/route.ts` <br> `src/app/api/resumes/download/route.ts` | `POST` <br> `GET` | **Internal Error Leakage**: Try/catch blocks in these routes return `error.message` directly to the client inside 500 responses. | Exposes database details, file-system structures, or library errors to clients, which could aid in vulnerability scanning. |
| 4 | Multiple Server Actions | Mutating Server Actions | **Inconsistent Return Shapes in Mutating Actions**: Mutating actions mix return patterns (some return `{ success: true }`, some return `{ error: string }`, and others throw raw Error objects), forcing verbose conditional checking on the client. | Standardize all mutating Server Actions to return a unified response wrapper (e.g., `{ success: true, data?: T }` on success, or `{ success: false, error: string }` on failure) rather than throwing. |

---

### LOW (polish and best practices)

| # | File | Route/Function | Issue | Recommendation |
|---|------|---------------|-------|----------------|
| 1 | `src/lib/audit.ts` <br> `src/middleware.ts` | Logging framework | **Lack of Request Correlation IDs**: Request logs and database audit logs are not linked by a common request tracking ID. | Introduce a correlation ID in the middleware headers and pass it through Server Actions to trace concurrent actions. |
| 2 | `src/app/api/auth/unified-login/route.ts` | `POST` | **Redundant MFA Cookie Presence**: When a login is successful without MFA, the `mfa-pending-token` cookie is not explicitly deleted. | Explicitly clear the `mfa-pending-token` cookie in the success response to maintain clean cookie state. |

---

### MISSING API ROUTES
- **No Missing Routes Found**: All routes referenced in the UI and server action code are fully implemented. The `/api/admin/employees/[id]/balances` route is correctly provisioned and implements `GET` and `POST` methods for admin balance management.

---

### INTEGRATION INVENTORY

#### 1. Supabase Database (`supabaseAdmin`)
- **Purpose**: Used for core transaction records, audit logging, rate limit tracking, and session data.
- **Initialization**: Lazily initialized in `src/lib/supabase-admin.ts`. If environment credentials are missing (e.g., during static page rendering in builds), it redirects queries to a recursive proxy (`mockClient`) that resolves with empty datasets, preventing build-time build failures.
- **Error Handling**: Uses try-catch blocks and logs raw Postgres error codes to the console.
- **Security Considerations**: Bypasses Row Level Security (RLS) as it uses the Service Role key. All functions utilizing `supabaseAdmin` verify roles and session validity using server-side auth guards (`verifyActiveSession`/`verifyActiveAdmin`).

#### 2. Supabase Auth
- **Purpose**: Authenticates administrative users.
- **Initialization**: Managed server-side via `signInWithPassword` in the unified login route using the admin client.
- **Error Handling**: Logs failures and redirects errors to standard credentials responses.
- **Security Considerations**: Isolated from client-side cookies; authenticates admins via a custom JWT session cookie rather than standard Supabase user objects on the client to ensure unified session lifetimes.

#### 3. Supabase Storage
- **Purpose**: Stores uploaded resumes and exported spreadsheets.
- **Initialization**: Initialized via the `supabaseAdmin.storage` client.
- **Error Handling**: Lists and purges files inside try-catch blocks.
- **Security Considerations**: Uploaded resumes are stored in a private bucket. The system never shares long-lived signed URLs with the client. Links are generated with a short-lived expiration (5 minutes for spreadsheets, 1 hour for resumes) through a secure API proxy `/api/resumes/download` that verifies session status in the database first.

#### 4. Resend Email
- **Purpose**: Dispatches transactional emails (leaves, WFH, assignments, inquiries).
- **Initialization**: Initialized conditionally in `src/lib/notifications.ts`. Returns a mocked console-logger if `RESEND_API_KEY` is not present in the environment variables.
- **Error Handling**: Self-contained error logging. Prevents email dispatch exceptions from bubbling up and interrupting parent database mutations.
- **Security Considerations**: All HTML templates use variables sanitized at the validation layers. Uses a single configured sender address `notifications@primetek.com`.

#### 5. Geoapify Maps
- **Purpose**: Fetches static map tiles for dashboard and settings pages.
- **Initialization**: Configured dynamically via Next.js remote images whitelist in `next.config.ts`.
- **Error Handling**: Relies on browser-native `<img>` fallbacks and remote image loader errors.
- **Security Considerations**: Whitelisted strictly under Content Security Policy (`connect-src` and `img-src`) to prevent arbitrary media injections.

#### 6. Vercel Cron
- **Purpose**: Executes automated daily cleanup tasks and month-end late penalty calculations.
- **Initialization**: Configured as `/api/cron/cleanup` and `/api/cron/late-penalty` endpoints.
- **Error Handling**: Wraps processes in global try-catch blocks, returning durations and failure details in JSON responses.
- **Security Considerations**: Authorizes executions via standard bearer checks using `CRON_SECRET` in the Request headers.

#### 7. Browser Geolocation API
- **Purpose**: Captures coordinates for geofencing compliance during clock-in/out and break actions.
- **Initialization**: Invoked via `navigator.geolocation.getCurrentPosition` with high accuracy enabled.
- **Error Handling**: Propagates permissions and hardware errors to standard UI banners.
- **Security Considerations**: Validates coordinates server-side against office location caches (Haversine formula), making client-side GPS mocking ineffective.

#### 8. Browser SharedWorker & BroadcastChannel APIs
- **Purpose**: Used by the multi-tab idle tracking and auto-break countdown system to coordinate activity states across multiple open dashboard tabs.
- **Initialization**: Initialized inside `AttendanceClient.tsx` with fallback.
- **Error Handling**: Falls back gracefully to `BroadcastChannel` and a local interval activity tracker if `SharedWorker` is blocked or unsupported in the browser.

---

### RESPONSE FORMAT CONSISTENCY ANALYSIS

| Server Action | Returns Shape (Success) | Returns Shape (Failure) | Consistent? | Reason/Notes |
|---|---|---|---|---|
| `getAdminAttendance` | `{ data: T[], count: number, ... }` | `{ data: [], count: 0, ... }` | Yes | Standardized read shape |
| `getAdminEmployees` | `EmployeeRecord[]` | `[]` | Yes | Returns empty array on fail |
| `toggleEmployeeStatus` | `void` | `throws Error` | No | Throws instead of returning failure status |
| `createEmployee` | `{ success: true, employee_id, password }` | `throws Error` | No | Throws instead of returning validation error |
| `deleteEmployee` | `void` | `throws Error` | No | Throws on database failure |
| `updateEmployeeBalances` | `{ success: true }` | `throws Error` | No | Throws Zod or DB errors |
| `createProfile` | `{ success: true }` | `{ error: string }` | Yes | Graceful error responses |
| `updateProfile` | `{ success: true }` | `{ error: string }` | Yes | Graceful error responses |
| `deleteProfile` | `{ success: true }` | `{ error: string }` | Yes | Graceful error responses |
| `uploadClientResume` | `{ success: true, url: string }` | `{ error: string }` | Yes | Graceful error responses |
| `checkIn` | `{ success: true, recordId }` | `{ success: false, error }` | Yes | Standard boolean status response |
| `checkOut` | `{ success: true }` | `{ success: false, error }` | Yes | Standard boolean status response |
| `applyForLeave` | `{ success: true }` | `throws Error` | No | Throws validation and override errors |
| `updateLeaveStatus` | `{ success: true }` | `throws Error` / returns `{ success: false, error }` | No | Throws on permission/atomic check errors; returns object on processed errors |
| `updateWFHStatus` | `{ success: true }` | `throws Error` / returns `{ success: false, error }` | No | Throws on permission/atomic check errors; returns object on processed errors |
| `changePassword` | `{ success: true }` | `throws Error` | No | Throws Zod/validation or DB errors |
| `updateAdminProfile` | `{ success: true }` | `throws Error` | No | Throws Zod/validation or DB errors |
| `updateProfileStatus` | `{ success: true }` | `throws Error` | No | Throws validation or DB errors |
| `submitInterviewRequest` | `{ success: true }` | `throws Error` | No | Throws validation or DB errors |
| `saveOfficeLocation` | `{ success: true }` | `throws Error` | No | Throws validation or DB errors |
| `saveNotificationPreferences`| `{ success: true }` | `throws Error` | No | Throws database errors |
| `submitDailyMetrics` | `{ success: true }` | `throws Error` | No | Throws validation or DB errors |

---

### POSITIVE FINDINGS
1. **Cryptographic CAPTCHA Nonce Verification**: Captcha values are signed using AES-GCM in the backend. Verification validates both the answer and the unique nonce, preventing clients from reusing answers or bypassing the lockouts.
2. **Server-Side File Verification**: Resume uploads in both public applications and admin profile actions read file binary magic headers (e.g., `25504446` for PDF and `504B0304` for DOCX) rather than trusting MIME-type strings.
3. **Database-backed Rate Limiting**: The `DbRateLimiter` synchronizes lockout thresholds directly in the database (`rate_limits` table), preventing serverless instances from losing rate state on restarts.
4. **Secure Proxy Download for Resumes**: Resume downloads are routing-proxied, validating database auth tokens before generating short-lived 1-hour signed URLs. This is much more secure than long-lived or 10-year signed URLs.
5. **Robust Tab-Coordinating Idle Tracker Fallback**: The client-side multi-tab idle tracking coordinates states across active dashboard tabs using `SharedWorker` and falls back automatically to `BroadcastChannel` + local timer coordination if `SharedWorker` is unsupported or blocked.


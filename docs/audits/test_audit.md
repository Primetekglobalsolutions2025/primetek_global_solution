You are a senior full-stack engineer and testing specialist performing a deep test coverage audit of this Next.js HR portal. Your role is AUDIT ONLY — do not write any tests or modify any code unless explicitly told to do so. Produce a structured report of every testing gap found.

This is a production HR system handling employee authentication, GPS-based attendance tracking, payroll deductions, leave management, and file uploads. Untested code in this system can cause payroll errors, attendance fraud, data loss, and security breaches.

═══════════════════════════════════════════════════════════
SCOPE: FULL TEST COVERAGE AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report:

── TEST INFRASTRUCTURE (check if these exist) ──
jest.config.js or jest.config.ts
vitest.config.js or vitest.config.ts
playwright.config.js or playwright.config.ts
cypress.config.js or cypress.config.ts
package.json (check scripts and devDependencies for test tooling)
.github/workflows/ (check for CI test pipelines)
**tests**/ (check if this directory exists)
src/**tests**/ (check if this directory exists)
tests/ (check if this directory exists)
e2e/ (check if this directory exists)

── CORE LIBRARY (highest priority to test) ──
src/lib/auth.ts
src/lib/utils.ts
src/lib/offline-queue.ts
src/lib/validations.ts
src/lib/location.ts
src/lib/audit.ts
src/lib/notifications.ts
src/lib/security/risk-engine.ts
src/lib/security/client-fingerprint.ts
src/lib/security/device-detect.ts

── CRITICAL SERVER ACTIONS ──
src/app/employee/attendance/actions.ts
src/app/employee/leaves/actions.ts
src/app/employee/daily-report/actions.ts
src/app/employee/assigned-profiles/actions.ts
src/app/employee/profile/actions.ts
src/app/admin/attendance/actions.ts
src/app/admin/approvals/actions.ts
src/app/admin/employees/actions.ts
src/app/admin/client-profiles/actions.ts
src/app/admin/applications/actions.ts
src/app/admin/settings/actions.ts
src/app/admin/profile/actions.ts

── API ROUTES ──
src/app/api/auth/unified-login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/me/route.ts
src/app/api/attendance/checkin/route.ts
src/app/api/attendance/checkout/route.ts
src/app/api/cron/cleanup/route.ts
src/app/api/cron/late-penalty/route.ts

── HOOKS ──
src/hooks/useOfflineSync.ts

── MIDDLEWARE ──
src/middleware.ts

═══════════════════════════════════════════════════════════
TEST COVERAGE AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. TEST INFRASTRUCTURE ──
□ Is any test framework configured (Jest, Vitest, Playwright, Cypress)?
□ Are there any test scripts in package.json?
□ Are there any existing test files anywhere in the project?
□ Is there a CI pipeline that runs tests?
□ Is there a test database or mock setup?
□ Are there any snapshot tests?
□ Is there a code coverage threshold configured?
□ Are there any mocks for Supabase, Resend, or other integrations?

── 2. UTILITY FUNCTION COVERAGE ──
□ Is getISTShiftDate() tested for all shift boundary cases?

- Before noon IST (should return yesterday's date)
- After noon IST (should return today's date)
- Exactly at noon IST (boundary case)
- Midnight UTC (which is 5:30 AM IST — should return today)
- 11:59 PM IST (should return today)
  □ Is calculateDistance() tested with known coordinate pairs?
  □ Is formatDuration() tested for edge cases (0 seconds, negative, >24h)?
  □ Is formatDate() tested for timezone correctness?
  □ Is cn() (classnames utility) tested?
  □ Is getOfflineQueue() tested for TTL expiry logic?
  □ Is enqueueOfflineAction() tested for duplicate prevention?
  □ Is the orphaned checkout detection in getOfflineQueue() tested?

── 3. VALIDATION SCHEMA COVERAGE ──
□ Is clientProfileSchema tested for all valid and invalid inputs?
□ Is fullApplicationSchema tested?
□ Is employeeProfileUpdateSchema tested?
□ Is changePasswordSchema tested for all password rules?

- Minimum 12 characters
- Requires uppercase
- Requires lowercase
- Requires number
- Requires special character
- Passwords must match
  □ Is the metricEntrySchema in daily-report/actions.ts tested?
  □ Are Zod validation error messages tested to be user-friendly?

── 4. AUTHENTICATION FLOW COVERAGE ──
□ Is the unified login tested for correct admin authentication?
□ Is the unified login tested for correct employee authentication?
□ Is the unified login tested for invalid credentials (wrong password)?
□ Is the unified login tested for inactive account rejection?
□ Is the unified login tested for rate limiting (after N failed attempts)?
□ Is the unified login tested for CAPTCHA requirement after threshold?
□ Is the MFA flow tested (pending token → TOTP verification)?
□ Is getSession() tested for valid token parsing?
□ Is getSession() tested for expired token rejection?
□ Is getSession() tested for tampered token rejection?
□ Is verifyToken() tested for all failure cases?
□ Is the logout flow tested (session invalidation in DB)?
□ Is the /api/auth/me endpoint tested for correct user data return?

── 5. ATTENDANCE ACTION COVERAGE ──
□ Is checkIn() tested for successful check-in within geofence?
□ Is checkIn() tested for rejection outside geofence?
□ Is checkIn() tested for duplicate check-in prevention?
□ Is checkIn() tested for stale session closure before new check-in?
□ Is checkIn() tested for lateness calculation (after 6:45 PM IST)?
□ Is checkIn() tested for on-time check-in (before 6:45 PM IST)?
□ Is checkIn() tested for future timestamp rejection?
□ Is checkIn() tested for shift date mismatch rejection?
□ Is checkOut() tested for successful checkout?
□ Is checkOut() tested for IDOR protection (wrong employee_id)?
□ Is checkOut() tested for already-checked-out rejection?
□ Is startBreak() tested for successful break start?
□ Is startBreak() tested for rejection when not in Working status?
□ Is endBreak() tested for correct break duration calculation?
□ Is resumeSession() tested for 15-minute window enforcement?
□ Is resumeSession() tested for system-forced logout resume?
□ Is closeStaleSessionsForEmployee() tested for cross-shift closure?
□ Is requestWFH() tested for successful WFH request creation?
□ Is processHeartbeat() tested for sequence number validation?

── 6. LEAVE ACTION COVERAGE ──
□ Is applyForLeave() tested for successful casual leave application?
□ Is applyForLeave() tested for weekend rejection?
□ Is applyForLeave() tested for overlapping leave rejection?
□ Is applyForLeave() tested for 1-day CL limit enforcement?
□ Is applyForLeave() tested for monthly CL limit (1 per month)?
□ Is updateLeaveStatus() tested for approval with balance deduction?
□ Is updateLeaveStatus() tested for rejection without balance change?
□ Is updateLeaveStatus() tested for idempotency (already processed)?
□ Is getLeaveBalances() tested for correct balance initialization?

── 7. SECURITY & AUTHORIZATION COVERAGE ──
□ Is IDOR protection tested on checkOut (wrong employee)?
□ Is IDOR protection tested on rebuildSession (wrong employee)?
□ Is IDOR protection tested on logGPSDismissEvent (wrong employee)?
□ Is IDOR protection tested on submitDispute (wrong attendance)?
□ Is role enforcement tested (employee calling admin actions)?
□ Is unauthenticated access tested (no session cookie)?
□ Is the middleware tested for admin route protection?
□ Is the middleware tested for employee route protection?
□ Is the middleware tested for inactive employee blocking?
□ Is the middleware tested for token revocation (logged-out token)?
□ Is the CSRF check in middleware tested?
□ Is the rate limiter tested for lockout after N attempts?
□ Is the file upload magic bytes check tested for each file type?
□ Is GPS coordinate spoofing protection tested?

── 8. OFFLINE QUEUE COVERAGE ──
□ Is the offline queue tested for check-in enqueue?
□ Is the offline queue tested for check-out enqueue?
□ Is the offline queue tested for duplicate prevention?
□ Is the offline queue tested for 72-hour TTL expiry?
□ Is the offline queue tested for orphaned checkout detection?
□ Is the offline queue tested for max retry cap (3 retries)?
□ Is the sync order tested (check-in before check-out)?
□ Is the break_start and break_end queue tested?

── 9. RISK ENGINE COVERAGE ──
□ Is the risk engine tested for office network detection?
□ Is the risk engine tested for new device detection?
□ Is the risk engine tested for concurrent session detection?
□ Is the risk engine tested for GPS outside office radius?
□ Is the risk engine tested for rapid action detection?
□ Is the final risk level calculation tested (low/medium/high thresholds)?
□ Is the risk event persistence tested?

── 10. API ROUTE COVERAGE ──
□ Is the check-in route tested for rate limit enforcement?
□ Is the check-in route tested for missing coordinates rejection?
□ Is the check-out route tested for missing recordId rejection?
□ Is the cron cleanup route tested for CRON_SECRET validation?
□ Is the cron late-penalty route tested for CRON_SECRET validation?
□ Are API routes tested for correct HTTP status codes?
□ Are API routes tested for correct response shapes?

── 11. CRITICAL BUSINESS LOGIC COVERAGE ──
□ Is the shift date boundary logic tested (6:30 PM IST shift start)?
□ Is the late threshold tested (15 minutes grace period)?
□ Is the late minutes calculation tested for accuracy?
□ Is the productive hours calculation tested?
□ Is the break seconds accumulation tested across multiple breaks?
□ Is the leave balance deduction tested for working days calculation?
□ Is the weekend exclusion in calculateWorkingDays() tested?
□ Is the Excel export tested for correct status code mapping?
□ Is the daily metrics upsert conflict resolution tested?

── 12. INTEGRATION TEST COVERAGE ──
□ Are there integration tests for the full check-in → check-out flow?
□ Are there integration tests for the leave request → approval flow?
□ Are there integration tests for the WFH request → approval flow?
□ Are there integration tests for the dispute → resolution flow?
□ Are there integration tests for employee creation → login flow?
□ Are there integration tests for the offline queue → sync flow?

── 13. E2E TEST COVERAGE ──
□ Is there an E2E test for admin login?
□ Is there an E2E test for employee login?
□ Is there an E2E test for employee check-in on mobile?
□ Is there an E2E test for employee check-out?
□ Is there an E2E test for leave application submission?
□ Is there an E2E test for admin leave approval?
□ Is there an E2E test for daily report submission?
□ Is there an E2E test for the offline → sync flow?

── 14. ERROR BOUNDARY COVERAGE ──
□ Are error.tsx boundaries tested for rendering on server errors?
□ Are loading.tsx skeletons tested for correct rendering?
□ Are empty states tested (no attendance records, no leaves, etc.)?
□ Are network error states tested in client components?

═══════════════════════════════════════════════════════════
RISK ASSESSMENT REQUIRED
═══════════════════════════════════════════════════════════

For every untested area, assess the risk level:

🔴 CRITICAL RISK — Untested code that handles money, auth, or data integrity
Examples: lateness calculation, leave balance deduction, IDOR checks,
JWT validation, shift boundary logic

🟠 HIGH RISK — Untested code that affects core functionality
Examples: check-in/out flow, offline queue ordering, geofence validation,
rate limiting, file upload security

🟡 MEDIUM RISK — Untested code that affects user experience
Examples: form validation, error messages, status transitions,
pagination, search filtering

🟢 LOW RISK — Untested code that is cosmetic or non-critical
Examples: UI utilities, formatting functions, animation helpers

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/TEST_COVERAGE_AUDIT_REPORT.md

## TEST COVERAGE AUDIT REPORT — [Date]

### INFRASTRUCTURE STATUS

State clearly whether any test framework exists.
If none exists, this is the first finding.

### SUMMARY TABLE

| Category           | Functions/Actions | Tested | Untested | Coverage % |
| ------------------ | ----------------- | ------ | -------- | ---------- |
| Utility Functions  |                   |        |          |            |
| Validation Schemas |                   |        |          |            |
| Auth Flow          |                   |        |          |            |
| Attendance Actions |                   |        |          |            |
| Leave Actions      |                   |        |          |            |
| Security/IDOR      |                   |        |          |            |
| Offline Queue      |                   |        |          |            |
| Risk Engine        |                   |        |          |            |
| API Routes         |                   |        |          |            |
| Business Logic     |                   |        |          |            |
| Integration Flows  |                   |        |          |            |
| E2E Flows          |                   |        |          |            |
| **TOTAL**          |                   |        |          |            |

### 🔴 CRITICAL RISK — Untested (fix immediately)

| #   | Function/Module | File | What Could Go Wrong |
| --- | --------------- | ---- | ------------------- |

### 🟠 HIGH RISK — Untested (fix this sprint)

| #   | Function/Module | File | What Could Go Wrong |
| --- | --------------- | ---- | ------------------- |

### 🟡 MEDIUM RISK — Untested (fix next sprint)

| #   | Function/Module | File | What Could Go Wrong |
| --- | --------------- | ---- | ------------------- |

### 🟢 LOW RISK — Untested (backlog)

| #   | Function/Module | File | What Could Go Wrong |
| --- | --------------- | ---- | ------------------- |

### RECOMMENDED TEST SETUP

If no test framework exists, recommend:

- Which framework to use (Jest vs Vitest, Playwright vs Cypress)
- How to set it up for this Next.js project
- Which mocking strategy to use for Supabase
- Which mocking strategy to use for Next.js server actions
- Recommended folder structure for tests
- Recommended CI pipeline configuration

### PRIORITY TEST WRITING ORDER

Ordered list of the top 20 tests to write first,
with estimated effort (S=1h, M=2-4h, L=1day) and
the exact function/scenario each test should cover.

### POSITIVE FINDINGS

List any existing tests or testing infrastructure found.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════

- Read every file listed above before writing the report.
- Do not write any test code. Audit only.
- If no test framework exists, state this clearly as the
  first and most critical finding.
- For every untested function, describe exactly what scenario
  could go wrong in production if it is not tested.
- Pay special attention to:
  - getISTShiftDate() — wrong shift date = wrong attendance record
  - Lateness calculation — wrong server clock usage = payroll error
  - Leave balance deduction — non-atomic = double deduction
  - IDOR checks — missing = employee sees other employee data
  - Offline queue ordering — wrong order = checkout before check-in
  - JWT validation — weak test = auth bypass in production
  - File upload magic bytes — untested = malware upload possible
- Cross-reference the SECURITY_AUDIT_REPORT.md and
  AUDIT_REPORT.md for issues that were fixed — those fixes
  need regression tests to ensure they are never broken again.


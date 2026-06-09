You are a senior full-stack engineer and testing specialist.
Your task is to set up the complete test infrastructure and write
ALL tests identified in docs/audits/TEST_COVERAGE_AUDIT_REPORT.md.
Read that file completely before writing a single line of test code.

The approach is DIRECT TESTING — no mocks, no stubs, no fakes.
Tests run against a real Supabase test project (separate from production).
This means tests are real, reliable, and reflect actual system behavior.

═══════════════════════════════════════════════════════════
APPROACH: DIRECT TESTING STRATEGY
═══════════════════════════════════════════════════════════

Tests are split into two categories:

CATEGORY A — Pure Function Tests (no DB, no network needed)
These test functions that take inputs and return outputs only.
No setup required. Run instantly.
Files: utils.ts, validations.ts, location.ts, offline-queue.ts,
device-detect.ts, auth.ts (JWT functions only)

CATEGORY B — Integration Tests (real Supabase test project)
These test server actions and API routes against a real DB.
Require a .env.test file with test Supabase credentials.
Each test seeds its own data and cleans up after itself.
Files: all actions.ts files, API routes, middleware

CATEGORY C — E2E Tests (real browser + real dev server)
These test complete user flows in a real browser.
Require the dev server running with test environment.
Files: e2e/ folder using Playwright

═══════════════════════════════════════════════════════════
PHASE 1 — INFRASTRUCTURE SETUP
═══════════════════════════════════════════════════════════

SETUP-1: Install test dependencies
Run:
npm install -D vitest @vitest/coverage-v8 @playwright/test

No @testing-library, no msw, no jsdom needed.
Vitest runs in node environment for server action tests.

---

SETUP-2: Create vitest.config.ts at the project root
The config must:

- Set environment to 'node' (not jsdom — we are testing server code)
- Enable globals: true
- Set setupFiles to ['./src/__tests__/setup.ts']
- Alias @ to ./src
- Configure coverage with v8 provider
- Set coverage thresholds: lines 70%, statements 70%
- Exclude node_modules, .next, supabase/migrations, e2e/ from coverage
- Set testTimeout to 15000 (15 seconds — real DB calls take time)
- Set pool to 'forks' to isolate each test file in its own process

---

SETUP-3: Create .env.test at the project root
This file holds credentials for the TEST Supabase project.
It must be separate from .env.local (production credentials).
The file must contain:
NEXT_PUBLIC_SUPABASE_URL=<your test supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your test anon key>
SUPABASE_SERVICE_ROLE_KEY=<your test service role key>
JWT_SECRET=test-jwt-secret-minimum-32-characters-long
CRON_SECRET=test-cron-secret

Add .env.test to .gitignore so it is never committed.

---

SETUP-4: Create src/**tests**/setup.ts
This file must:

- Load .env.test using dotenv before any test runs:
  import { config } from 'dotenv'
  config({ path: '.env.test' })
- Export a helper function cleanupTestData(employeeId) that
  deletes all test records created during a test from:
  attendance, attendance_events, attendance_projections,
  leave_requests, leave_balances, disputes, active_sessions,
  trusted_devices, attendance_risk_events
  This is called in afterEach blocks to keep the test DB clean.
- Export a helper function createTestEmployee() that inserts
  a real employee record into the test DB and returns the
  employee object including id, employee_id, and password.
  The employee is created with a known password so login tests work.
- Export a helper function createTestAdmin() that creates or
  fetches the test admin user from admin_users table.
- Export a helper function getTestSession(employeeId) that
  creates a real JWT token for the given employee ID using
  createToken() from src/lib/auth.ts.

---

SETUP-5: Create playwright.config.ts at the project root
The config must:

- Set baseURL to http://localhost:3000
- Set testDir to e2e/
- Configure two projects: chromium and mobile-chrome
- Set mobile-chrome viewport to 390x844 (iPhone 14)
- Set timeout to 30 seconds
- Configure webServer to run 'npm run dev' automatically
  before E2E tests start, with url: 'http://localhost:3000'
  and reuseExistingServer: true
- Enable screenshot on failure
- Set retries to 1 in CI

---

SETUP-6: Add test scripts to package.json
Add:
"test": "vitest run"
"test:watch": "vitest"
"test:coverage": "vitest run --coverage"
"test:e2e": "playwright test"
"test:e2e:ui": "playwright test --ui"

---

SETUP-7: Seed the test database
Before running any Category B tests, the test Supabase project
needs the same schema as production.
Run the existing migrations against the test project:
npx supabase db push --db-url <test project DB URL>
This applies all files in supabase/migrations/ to the test DB.

═══════════════════════════════════════════════════════════
PHASE 2 — PURE FUNCTION TESTS (Category A)
No DB needed. Run instantly.
═══════════════════════════════════════════════════════════

Create file: src/**tests**/pure/utils.test.ts

Import getISTShiftDate, calculateDistance, formatDate directly
from src/lib/utils.ts. No setup needed.

TEST-P1: getISTShiftDate() all shift boundary cases

- Construct Date objects using UTC milliseconds to avoid
  local machine timezone interference.
- Before noon IST = UTC hour < 6 (or UTC hour 6 with minutes < 30)
  → must return yesterday's date string
- After noon IST = UTC hour >= 6:30
  → must return today's date string
  Write at least 10 boundary cases covering:
  11:59 AM IST, 12:00 PM IST, 12:01 PM IST,
  6:30 PM IST, 11:59 PM IST, 12:00 AM IST,
  3:30 AM IST, 5:29 AM IST, 5:30 AM IST, 5:31 AM IST
  For each case assert the returned string is YYYY-MM-DD format
  and matches the expected date.

TEST-P2: calculateDistance() accuracy

- Same point → must return 0
- Two points 100m apart (use known coords) → within 5m of 100
- Two points 500m apart → within 10m of 500
- Two points 1km apart → within 20m of 1000
- Hyderabad to Mumbai → must be > 500,000 meters
- Point 499m from office → isWithinOffice must return true
- Point 501m from office → isWithinOffice must return false

TEST-P3: formatDate() output

- Must return a non-empty string for any valid date input
- Must not throw for ISO date strings
- Must not throw for Date objects

---

Create file: src/**tests**/pure/validations.test.ts

Import all schemas directly from src/lib/validations.ts.

TEST-P4: changePasswordSchema

- Under 12 chars → must fail
- No uppercase → must fail
- No lowercase → must fail
- No number → must fail
- No special char → must fail
- Passwords not matching → must fail on confirmPassword field
- Valid password 'TestPass123!' → must pass
- Exactly 12 chars meeting all rules → must pass

TEST-P5: clientProfileSchema

- Valid full profile → must pass
- Missing client_name → must fail
- client_name over 200 chars → must fail
- Invalid email format → must fail
- Invalid LinkedIn URL → must fail
- Extra unknown field → must be stripped from output
- Partial update (all optional) → must pass

TEST-P6: employeeProfileUpdateSchema

- Valid name and phone → must pass
- Name under 2 chars → must fail
- Name over 100 chars → must fail
- Phone with letters → must fail
- Empty phone → must pass (optional field)

TEST-P7: fullApplicationSchema

- Valid complete application → must pass
- Missing job_id → must fail
- Invalid email → must fail
- role_category not IT or Non-IT → must fail

---

Create file: src/**tests**/pure/offline-queue.test.ts

Import all functions directly from src/lib/offline-queue.ts.
These use localStorage — use the 'happy-dom' environment for this
file only by adding a vitest docblock comment at the top:
// @vitest-environment happy-dom

TEST-P8: enqueueOfflineAction() duplicate prevention

- Enqueue check_in → must return entry with status 'pending'
- Enqueue second check_in same shift date → must throw
- Enqueue check_out → must succeed
- Enqueue second check_out same shift date → must throw
- Mark first check_in as 'failed' → enqueue new check_in must succeed

TEST-P9: getOfflineQueue() TTL and cleanup

- Entry 71 hours old → must remain in queue
- Entry 73 hours old → must be removed and archived
- Entry with retryCount 3 → must be removed and archived
- Orphaned check_out (no parent check_in in queue) → must be archived

TEST-P10: Queue ordering

- Enqueue check_in then check_out
- getOfflineQueue() must return check_in before check_out
- check*out with offline* recordId must not be synced until
  parent check_in is resolved

---

Create file: src/**tests**/pure/auth-crypto.test.ts

Import createToken, verifyToken, createCaptchaToken,
verifyCaptchaToken directly from src/lib/auth.ts.
Set JWT_SECRET in process.env before tests run.

TEST-P11: createToken() and verifyToken()

- Create token with valid payload → verifyToken must return payload
- Tamper with token string → verifyToken must return null
- Use wrong secret to verify → must return null
- Token with all required fields (id, email, role) → verify fields present

TEST-P12: createCaptchaToken() and verifyCaptchaToken()

- Create token for answer 7, verify with 7 → must return true
- Create token for answer 7, verify with 8 → must return false
- Tampered token string → must return false
- Empty string → must return false

---

Create file: src/**tests**/pure/location.test.ts

Import haversineDistance, isWithinOffice directly from src/lib/location.ts.

TEST-P13: haversineDistance() precision

- Identical coordinates → must return 0
- Known pair 100m apart → within 2m of 100
- Known pair 500m apart → within 5m of 500
- isWithinOffice with office coords → must return true
- isWithinOffice with coords 600m away → must return false

---

Create file: src/**tests**/pure/device-detect.test.ts

Import getDeviceInfo directly from src/lib/security/device-detect.ts.
Override navigator.userAgent in each test using Object.defineProperty.

TEST-P14: getDeviceInfo() device classification

- iPhone UA → deviceType must be 'mobile'
- iPad UA → deviceType must be 'tablet'
- Windows Chrome UA → deviceType must be 'desktop'
- Android UA → deviceType must be 'mobile'
- MacBook Safari UA → deviceType must be 'desktop'
- deviceLabel must contain both OS name and browser name

═══════════════════════════════════════════════════════════
PHASE 3 — INTEGRATION TESTS (Category B)
Real Supabase test project. Each test seeds and cleans its own data.
═══════════════════════════════════════════════════════════

IMPORTANT RULES FOR ALL INTEGRATION TESTS:

- Every test must call createTestEmployee() in beforeEach
  to get a fresh employee with a known ID and password.
- Every test must call cleanupTestData(employee.id) in afterEach
  to delete all records created during the test.
- Never hardcode UUIDs — always use the IDs returned by setup helpers.
- Tests must be runnable in any order and in parallel.
- Use the real supabaseAdmin client from src/lib/supabase-admin.ts
  which will connect to the test DB via .env.test credentials.

---

Create file: src/**tests**/integration/attendance.test.ts

TEST-I1: checkIn() successful check-in within geofence

- Create test employee
- Call checkIn() with office coordinates and employee session
- Assert return value is { success: true, recordId: string }
- Query attendance table directly and assert record exists
- Query attendance_events and assert CLOCK_IN event exists
- Query attendance_projections and assert projection exists

TEST-I2: checkIn() rejection outside geofence

- Call checkIn() with coordinates 2km from office
- Assert return value is { success: false, outOfRadius: true }
- Assert no attendance record was created

TEST-I3: checkIn() duplicate prevention

- Call checkIn() once successfully
- Call checkIn() again for the same employee same day
- Assert second call returns { success: false, error: 'Already clocked in' }

TEST-I4: checkIn() lateness calculation

- Set up a test where server time is after 6:45 PM IST
  (use a real timestamp that is in the late window)
- Call checkIn() and assert is_late is true in the DB record
- Set up a test where server time is before 6:45 PM IST
- Call checkIn() and assert is_late is false

TEST-I5: checkOut() IDOR protection

- Create two test employees (A and B)
- Employee A checks in
- Employee B tries to check out Employee A's session
- Assert { success: false, error: 'Attendance check-in record not found' }
- Assert Employee A's record still has check_out = null

TEST-I6: checkOut() successful checkout

- Employee checks in
- Employee checks out with same session
- Assert { success: true }
- Assert check_out is set in DB
- Assert CLOCK_OUT event exists in attendance_events
- Assert productive_hours > 0 in attendance table

TEST-I7: startBreak() and endBreak() flow

- Employee checks in
- Employee starts break
- Assert status = 'Break' in DB
- Assert BREAK_STARTED event exists
- Employee ends break
- Assert status = 'Working' in DB
- Assert BREAK_ENDED event exists
- Assert total_break_seconds > 0

TEST-I8: resumeSession() 15-minute window

- Employee checks in then checks out
- Immediately call resumeSession()
- Assert { success: true }
- Assert check_out is null again in DB
- Assert SESSION_RECOVERED event exists

---

Create file: src/**tests**/integration/leaves.test.ts

TEST-I9: applyForLeave() successful casual leave

- Create test employee
- Call applyForLeave() with a valid weekday date
- Assert { success: true }
- Query leave_requests and assert record exists with status 'Pending'

TEST-I10: applyForLeave() weekend rejection

- Call applyForLeave() with a Saturday date
- Assert { success: false, error contains 'weekend' }
- Assert no leave_request record was created

TEST-I11: applyForLeave() overlap rejection

- Apply for leave on date X (succeeds)
- Apply for leave on date X again
- Assert second call returns { success: false, error contains 'overlapping' }

TEST-I12: applyForLeave() monthly CL limit

- Apply for casual leave this month (succeeds)
- Apply for another casual leave same month
- Assert { success: false, error contains 'already requested' }

TEST-I13: updateLeaveStatus() approval with balance deduction

- Create test employee with leave balance
- Employee applies for casual leave
- Admin approves the leave
- Assert leave_requests.status = 'Approved'
- Assert leave_balances.used_days increased by 1
- Assert leave_balances.remaining_days decreased by 1

TEST-I14: updateLeaveStatus() idempotency

- Approve a leave request
- Approve the same leave request again
- Assert second call returns { success: true } without error
- Assert used_days was only incremented once

---

Create file: src/**tests**/integration/security.test.ts

TEST-I15: IDOR on submitDispute

- Create two employees (A and B)
- Employee A checks in (creates attendance record)
- Employee B tries to submit dispute with Employee A's attendanceId
- Assert { success: false, error contains 'Unauthorized' }
- Assert no dispute record was created

TEST-I16: IDOR on rebuildSession

- Create two employees (A and B)
- Employee A checks in
- Employee B tries to rebuild Employee A's session
- Assert { success: false, error contains 'Unauthorized' }

TEST-I17: Role enforcement — employee calling admin action

- Create test employee (not admin)
- Call toggleExemption() with employee session
- Assert { success: false } or thrown Unauthorized error
- Assert no changes were made to the attendance record

TEST-I18: verifyActiveSession() blocks inactive employee

- Create test employee
- Set employee status to 'Inactive' in DB
- Call checkIn() with that employee's session
- Assert the action is blocked with Unauthorized error

TEST-I19: File upload magic bytes validation

- Call uploadClientResume() with a buffer that has EXE magic bytes
  but a .pdf extension
- Assert { error contains 'Invalid' }
- Assert no file was uploaded to storage

TEST-I20: Cron secret validation

- Call the cleanup cron handler with no Authorization header
- Assert 401 response
- Call with wrong secret
- Assert 401 response
- Call with correct CRON_SECRET
- Assert 200 response

---

Create file: src/**tests**/integration/employees.test.ts

TEST-I21: createEmployee() full flow

- Call createEmployee() with valid data
- Assert { success: true, employee_id, password }
- Assert employee_id matches pattern /^cmk\d{7}$/
- Assert employee record exists in DB
- Assert leave_balance record was created for current month
- Assert audit log was created with CREATE_EMPLOYEE action
- Verify the returned password works by calling bcrypt.compare
  against the stored password_hash

TEST-I22: deleteEmployee() cascade cleanup

- Create test employee
- Employee checks in (creates attendance, events, projections)
- Delete the employee
- Assert employee record is gone
- Assert active_sessions records are gone
- Assert trusted_devices records are gone
- Assert audit log was created with DELETE_EMPLOYEE action

---

Create file: src/**tests**/integration/daily-report.test.ts

TEST-I23: submitDailyMetrics() ownership check

- Create two employees (A and B)
- Assign a profile to Employee A
- Employee B tries to submit metrics for Employee A's profile
- Assert { success: false, error contains 'Access denied' }

TEST-I24: submitDailyMetrics() upsert behavior

- Employee submits metrics for their profile
- Assert record created in profile_daily_metrics
- Employee submits metrics again for same profile same date
- Assert record was updated (not duplicated)
- Assert only 1 record exists for that profile+date combination

═══════════════════════════════════════════════════════════
PHASE 4 — E2E TESTS (Category C)
Real browser + real dev server. No mocks.
═══════════════════════════════════════════════════════════

Create file: e2e/helpers.ts
Export helper functions:

- loginAsAdmin(page) — navigates to /admin/login and logs in
- loginAsEmployee(page, employeeId, password) — logs in as employee
- logout(page) — clicks sign out and confirms

---

Create file: e2e/admin-login.spec.ts

TEST-E1: Admin login success

- Navigate to /admin/login
- Fill valid admin email and password
- Click login button
- Assert URL is /admin/dashboard
- Assert sidebar is visible
- Assert greeting contains admin name

TEST-E2: Admin login failure

- Fill wrong password
- Click login button
- Assert still on /admin/login
- Assert error message is visible

TEST-E3: Admin redirect when already logged in

- Log in as admin
- Navigate to /admin/login directly
- Assert redirected to /admin/dashboard

---

Create file: e2e/employee-login.spec.ts

TEST-E4: Employee login success

- Navigate to /employee/login
- Fill valid employee ID and password
- Click login button
- Assert URL is /employee/dashboard
- Assert welcome message is visible

TEST-E5: Employee login failure

- Fill wrong password
- Assert error message is visible

---

Create file: e2e/employee-attendance.spec.ts
Use mobile-chrome project for all tests in this file.

TEST-E6: Employee check-in flow

- Log in as employee
- Navigate to /employee/attendance
- Grant geolocation permission with office coordinates
- Click Clock In button
- Assert status badge shows Working
- Assert live timer is visible and counting
- Assert Clock Out button is visible

TEST-E7: Employee check-out flow

- Continue from TEST-E6 (or re-check-in)
- Click Clock Out button
- Confirm in the dialog
- Assert status badge shows Logged Out
- Assert duration is displayed

TEST-E8: Employee break flow

- Check in
- Click Start Break
- Assert status shows Break
- Click End Break
- Assert status returns to Working

---

Create file: e2e/employee-leaves.spec.ts

TEST-E9: Leave application on valid weekday

- Log in as employee
- Navigate to /employee/leaves
- Click Apply for Leave
- Select Casual leave type
- Pick a future weekday date
- Enter a reason
- Submit
- Assert success toast appears
- Assert new leave appears in list with Pending status

TEST-E10: Leave application on weekend is rejected

- Select a Saturday date
- Submit
- Assert error message about weekends appears
- Assert no new leave in the list

---

Create file: e2e/admin-approvals.spec.ts

TEST-E11: Admin approves a leave request

- Log in as admin
- Navigate to /admin/approvals
- Find a pending leave request
- Click Authorize
- Assert leave disappears from pending list
- Assert success toast appears

---

Create file: e2e/daily-report.spec.ts

TEST-E12: Employee submits daily report

- Log in as employee
- Navigate to /employee/daily-report
- Fill in metrics for an assigned profile
- Click Submit
- Assert success toast appears
- Assert the report shows as submitted for today

---

Create file: e2e/offline-sync.spec.ts

TEST-E13: Offline check-in queues and syncs on reconnect

- Log in as employee
- Navigate to /employee/attendance
- Use Playwright context.setOffline(true) to go offline
- Grant geolocation with office coordinates
- Click Clock In
- Assert offline banner appears with pending count 1
- Use context.setOffline(false) to go back online
- Assert sync banner shows Syncing
- Assert sync completes and status shows Working

═══════════════════════════════════════════════════════════
PHASE 5 — REGRESSION TESTS
═══════════════════════════════════════════════════════════

Create file: src/**tests**/regression/fixed-bugs.test.ts

These tests ensure previously fixed bugs never regress.
Each test has a comment referencing the original audit issue.

REGRESSION-1: Admin auto-upsert removed (Security C-12)
// Regression for SECURITY_AUDIT_REPORT.md Critical #12

- Call unified login with email matching ADMIN_EMAIL_ENV
  but not in admin_users table
- Assert response is 401 or 403
- Assert admin_users table was NOT modified

REGRESSION-2: closeStaleSessionsForEmployee not exported
// Regression for SECURITY_AUDIT_REPORT.md Critical #2

- Import \* from src/app/employee/attendance/actions.ts
- Assert closeStaleSessionsForEmployee is NOT in the exports object

REGRESSION-3: force-dynamic on approvals page
// Regression for AUDIT_REPORT.md Critical #6

- Import the approvals page module
- Assert exported dynamic === 'force-dynamic'

REGRESSION-4: force-dynamic on dashboard page
// Regression for AUDIT_REPORT.md Critical #10

- Import the dashboard page module
- Assert exported dynamic === 'force-dynamic'

REGRESSION-5: BOLA on submitDispute
// Regression for SECURITY_AUDIT_REPORT.md Critical #6

- Create two real employees in test DB
- Employee A checks in
- Employee B calls submitDispute with Employee A's attendanceId
- Assert { success: false } with Unauthorized message
- Assert no dispute record exists in DB

REGRESSION-6: Lateness uses server clock not client timestamp
// Regression for SECURITY_AUDIT_REPORT.md High #2

- Call checkIn() with a clientTimestamp 30 minutes in the past
  (employee trying to appear on-time by backdating)
- Assert the attendance record's is_late value reflects
  the actual server time, not the backdated client timestamp

═══════════════════════════════════════════════════════════
FOLDER STRUCTURE
═══════════════════════════════════════════════════════════

src/
**tests**/
setup.ts ← test helpers, env loading, cleanup
pure/
utils.test.ts
validations.test.ts
offline-queue.test.ts
auth-crypto.test.ts
location.test.ts
device-detect.test.ts
integration/
attendance.test.ts
leaves.test.ts
security.test.ts
employees.test.ts
daily-report.test.ts
regression/
fixed-bugs.test.ts

e2e/
helpers.ts
admin-login.spec.ts
employee-login.spec.ts
employee-attendance.spec.ts
employee-leaves.spec.ts
admin-approvals.spec.ts
daily-report.spec.ts
offline-sync.spec.ts

═══════════════════════════════════════════════════════════
RULES FOR THIS TEST SESSION
═══════════════════════════════════════════════════════════

1. Read docs/audits/TEST_COVERAGE_AUDIT_REPORT.md completely first.
2. Complete Phase 1 (infrastructure) before writing any tests.
   Run npm run test after setup to confirm the framework works.
3. Create .env.test with real test Supabase project credentials
   before running any integration tests.
4. Run supabase migrations against the test project before
   running integration tests.
5. Write tests in phase order: Pure → Integration → E2E → Regression.
6. Every integration test must seed its own data in beforeEach
   and clean up in afterEach. Never rely on pre-existing data.
7. Never use production Supabase credentials in tests.
   Always use .env.test credentials.
8. Run npm run test after each phase to confirm all tests pass.
9. Run npm run test:coverage after all phases and confirm
   overall coverage is above 70%.
10. If a test fails because the source code has a bug,
    note it as a new finding — do not change the test to pass.
11. Every regression test must have a comment referencing
    the original audit report issue it covers.
12. Do not install any mock libraries (msw, jest-mock, etc.).
    All tests use real implementations.


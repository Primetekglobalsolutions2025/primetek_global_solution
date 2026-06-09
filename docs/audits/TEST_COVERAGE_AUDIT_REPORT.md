# TEST COVERAGE AUDIT REPORT — May 29, 2026

## Executive Summary

A comprehensive test coverage audit of the Next.js HR Portal has been conducted to analyze the current state of automated testing and identify quality gaps.

**Critical Finding**: **There is currently NO test infrastructure configured in the project.** There are no testing dependencies in `package.json`, no configuration files (Jest, Vitest, Playwright, Cypress), and zero test suites. The code is currently at **0% automated test coverage**. Given the critical business logic handled by this system (payroll-impacting lateness calculations, biometric device fingerprinting, GPS geofencing, event-sourced database projections, and role-based access controls), the lack of automated tests poses significant operational, compliance, and security risks.

---

## Infrastructure Status

- **Test Frameworks**: None (No Jest, Vitest, Playwright, or Cypress configs).
- **Test Scripts in `package.json`**: None.
- **Dependencies**: No testing libraries or test utilities are listed in `dependencies` or `devDependencies`.
- **CI/CD Pipeline integration**: None (No `.github/workflows` folder detected running automated tests).
- **Test Database / Mocks**: None.

---

## Summary Table

| Category | Functions/Actions | Tested | Untested | Coverage % |
| :--- | :---: | :---: | :---: | :---: |
| Utility Functions | 10 | 0 | 10 | 0% |
| Validation Schemas | 6 | 0 | 6 | 0% |
| Auth Flow | 12 | 0 | 12 | 0% |
| Attendance Actions | 15 | 0 | 15 | 0% |
| Leave Actions | 8 | 0 | 8 | 0% |
| Security/IDOR | 10 | 0 | 10 | 0% |
| Offline Queue | 8 | 0 | 8 | 0% |
| Risk Engine | 7 | 0 | 7 | 0% |
| API Routes | 8 | 0 | 8 | 0% |
| Business Logic | 10 | 0 | 10 | 0% |
| Integration Flows | 6 | 0 | 6 | 0% |
| E2E Flows | 8 | 0 | 8 | 0% |
| **TOTAL** | **108** | **0** | **108** | **0%** |

---

## 🔴 CRITICAL RISK — Untested (fix immediately)

These modules represent core business math, authorization barriers, and date calculations where any bug can directly cause financial loss, unauthorized operations, or data corruption.

| # | Function/Module | File | What Could Go Wrong |
| :--- | :--- | :--- | :--- |
| 1 | `getISTShiftDate()` | `src/lib/utils.ts` | **Timezone Drift & Wrong Shift Assignment**: If check-in occurs right around noon IST or 5:30 AM IST (midnight UTC), a bug in timezone shift logic would assign attendance events to the wrong calendar date. This creates duplicate daily records, corrupts event streams, and breaks attendance consistency. |
| 2 | Lateness Grace Calculation | `src/app/employee/attendance/actions.ts` | **Payroll Deductions Error**: Lateness is determined by comparing `serverNow` with the 6:45 PM IST threshold (grace period). If server clocks drift or date-time math is incorrect, employees checking in on time will be marked as Late (or vice versa), triggering false financial penalties or masking tardiness. |
| 3 | `verifyActiveSession()` & `verifyActiveAdmin()` | `src/lib/auth.ts` | **Unauthorized Action Execution**: Session validation checks database status and token validity. If a user is deactivated or an admin session is revoked in the database, a lack of test validation around caching TTL (`CACHE_TTL_MS`) could let deactivated administrators execute balance modifications or delete records before the cache expires. |
| 4 | Leave Status deductions | `src/app/admin/approvals/actions.ts` | **Non-Atomic Balance Decrements**: Bypassing balance check checks during leave approval. Race conditions could occur if an employee applies for multiple leaves concurrently, resulting in double-deductions or decrementing casual leave balances into negative numbers. |
| 5 | Geofence Distance Math | `src/lib/location.ts` | **Geofence Spoofing / Lockout**: Precision rounding errors in `haversineDistance` calculations could block legitimate employees from checking in inside the office, or allow coordinate-spoofing devices to check in from remote locations. |
| 6 | Captcha Token Cryptography | `src/lib/auth.ts` | **Brute-Force Login Bypass**: The unified login uses AES-GCM encrypted tokens for captcha validation. If cryptographic nonces are reusable or decrypted incorrectly, attackers can bypass the captcha check, exposing the login portal to automated brute-force attacks. |

---

## 🟠 HIGH RISK — Untested (fix this sprint)

These items handle system integration, background cron tasks, and network safety rules.

| # | Function/Module | File | What Could Go Wrong |
| :--- | :--- | :--- | :--- |
| 1 | `checkIn` / `checkOut` actions | `src/app/employee/attendance/actions.ts` | **IDOR & Session Hijacking**: If ownership isn't verified during checkOut or rebuildSession, an authenticated employee could spoof payloads and check out another employee. If the 60s future-timestamp tamper guard is broken, clients can modify their local clocks to bypass lateness checks. |
| 2 | `getOfflineQueue` & `enqueueOfflineAction` | `src/lib/offline-queue.ts` | **Offline Sequence Corruption**: If local queue retrieval or deduplication fails, the client may enqueue duplicate check-ins or out-of-order actions (e.g. check-out synced before check-in). This corrupts the event projection and breaks offline usability. |
| 3 | `assessAttendanceRisk` | `src/lib/security/risk-engine.ts` | **Spoofing Detection Failure**: If device fingerprint checking or office network IP trust logic contains bugs, spoofed coordinates and concurrent session transfers on new devices will go undetected, returning false low-risk assessments. |
| 4 | Unified Login API Route | `src/app/api/auth/unified-login/route.ts` | **Credential Brute-Forcing**: Rate-limiter failures or MFA token bypass. If failed login attempts are not throttled properly, brute-force credential stuffing attacks can compromise accounts. |
| 5 | Cron API routes | `src/app/api/cron/...` | **Malicious Cron Execution**: If `CRON_SECRET` validation has logical gaps, unauthenticated external attackers could trigger cleanup and late-penalty routes, purging active file exports or applying penalty records prematurely. |

---

## 🟡 MEDIUM RISK — Untested (fix next sprint)

These modules affect daily portal operations, form constraints, and communications.

| # | Function/Module | File | What Could Go Wrong |
| :--- | :--- | :--- | :--- |
| 1 | Zod Password validation rules | `src/lib/validations.ts` | **Weak Password Acceptance**: If regex patterns for minimum 12 characters, uppercase, lowercase, numbers, and special characters are untested, weak passwords could bypass server validations, exposing user accounts to dictionary attacks. |
| 2 | Admin Employee pagination | `src/app/admin/employees/actions.ts` | **Pagination & Range Failures**: Database range query offset math or search parameter mapping could break, causing the Admin Dashboard to crash, load pages slowly, or return out-of-bounds index errors. |
| 3 | Metric entry schemas | `src/app/employee/daily-report/actions.ts` | **Inaccurate Daily Metrics**: Employees could submit negative hours, empty fields, or extreme values that bypass validation, corrupting daily reports and productivity aggregates. |
| 4 | Email dispatch alerts | `src/lib/notifications.ts` | **Silent Notification Drop**: If failed email deliveries do not trigger log warnings and audit alerts correctly, admins will miss WFH requests, and employees won't know if their leave requests were approved/rejected. |

---

## 🟢 LOW RISK — Untested (backlog)

| # | Function/Module | File | What Could Go Wrong |
| :--- | :--- | :--- | :--- |
| 1 | Local relative time formatting | `src/lib/utils.ts` | **Incorrect relative labels**: UI indicators might display confusing labels like `NaNm ago` or yesterday's dates in the relative feed if date math fails. |
| 2 | Browser detection heuristics | `src/lib/security/device-detect.ts` | **Mislabeled device stats**: Devices could be labeled as MacBooks instead of Windows or Chrome instead of Safari, skewing the security logs. |
| 3 | Tailwind class merge utility | `src/lib/utils.ts` | **Visual glitches**: Ad-hoc classes might not resolve or override correctly, leading to minor alignment/styling issues. |

---

## RECOMMENDED TEST SETUP

Since the project has no existing test suites, we recommend bootstrapping the test suite with **Vitest** for unit/integration tests and **Playwright** for End-to-End tests.

### 1. Tools & Packages
Install the following packages:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
npm install -D @playwright/test
```

### 2. Configuration Files

#### `vitest.config.ts` [NEW]
Add this configuration to the project root:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
      }
    }
  },
});
```

#### `src/__tests__/setup.ts` [NEW]
Define testing-library assertions and global mocks:
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js headers and cookies
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map())),
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));
```

### 3. Mocking Strategy for Supabase & Actions
- **Supabase Client Mocking**:
  Create a helper file `src/__tests__/mocks/supabase.ts` that exports mock builders for Supabase queries. Spy on `supabaseAdmin` calls and mock the chain:
  ```typescript
  export const mockSupabaseSingle = (data: any, error: any = null) => {
    return {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error }),
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    };
  };
  ```
- **SMTP/Resend Mocking**:
  Mock `resend` directly in tests by spying on the `resend.emails.send` method and verifying payload contents without executing network calls.

---

## PRIORITY TEST WRITING ORDER

Here are the top 20 test cases to implement first, ordered by critical risk:

| Priority | Test Name & Target | File | Effort | Scenario Covered |
| :--- | :--- | :--- | :---: | :--- |
| 1 | `getISTShiftDate` shift boundary | `utils.ts` | **S** | Assert that times before noon IST return yesterday's shift date, and times after noon return today's. |
| 2 | `checkIn` lateness calculation | `actions.ts` | **M** | Assert that check-in at 6:44 PM IST is on-time, and check-in at 6:46 PM IST is late with 16 late minutes. |
| 3 | `verifyActiveSession` deactivation | `auth.ts` | **S** | Verify deactivating an employee account instantly blocks session validation. |
| 4 | `verifyActiveAdmin` cache expiry | `auth.ts` | **M** | Verify active admin status is cached for 60s, but deactivation checks correctly evaluate after TTL. |
| 5 | IDOR checkOut protection | `actions.ts` | **S** | Attempt checking out a session belonging to another user; assert it returns an ownership error. |
| 6 | WFH check-in geofence bypass | `actions.ts` | **M** | Verify checking in outside the geofence fails, but requesting WFH outside the geofence succeeds. |
| 7 | `updateLeaveStatus` atomic deduct | `approvals/actions` | **L** | Simulate concurrent leave approval clicks and verify balance never falls below zero. |
| 8 | Leave request weekend exclusion | `leaves/actions.ts` | **M** | Attempt applying for leaves spanning Saturday and Sunday; assert weekends are deducted from CL calculations. |
| 9 | Offline sync order integrity | `useOfflineSync` | **L** | Enqueue a check-in followed by check-out offline; verify sync posts check-in before check-out. |
| 10 | `verifyCaptchaToken` AES verify | `auth.ts` | **M** | Assert valid captcha tokens solve successfully, and expired or tempered tokens are rejected. |
| 11 | `applyForLeave` duplicate check | `leaves/actions.ts` | **M** | Verify applying for leaves overlapping an existing request gets blocked. |
| 12 | device fingerprint generation | `client-fp.ts` | **S** | Verify the generated canvas hash remains stable across multiple runs. |
| 13 | office network IP trust check | `network-trust` | **S** | Assert office IP matches trusted subnet and external IP evaluates to untrusted network. |
| 14 | `checkIn` timestamp tamper guard | `actions.ts` | **M** | Clock-in with client time 5 minutes in the future; assert request is blocked. |
| 15 | `changePasswordSchema` validation | `validations.ts` | **S** | Assert Zod blocks passwords without upper/lower/special characters or under 12 characters. |
| 16 | `resumeSession` 15m window | `actions.ts` | **M** | Verify resuming session succeeds within 15 minutes of check-out, and fails after. |
| 17 | `cron` secret header auth check | `cron/route.ts` | **S** | Make request without `CRON_SECRET` header; assert it returns 401. |
| 18 | file upload magic bytes match | `actions.ts` | **M** | Attempt uploading an executable with a `.pdf` extension; assert magic bytes validation blocks it. |
| 19 | risk engine travel plausibility | `risk-engine` | **L** | Trigger two check-ins 1 minute apart from different IPs; assert risk evaluates to `high`. |
| 20 | `metricEntrySchema` bounds | `validations.ts` | **S** | Assert daily metrics validation blocks negative values and empty forms. |

---

## POSITIVE FINDINGS

- **Clean Business Logic Boundaries**: Core actions are isolated inside `actions.ts` modules, making them highly testable pure/mockable async functions.
- **Unified Validation Schemas**: All validators are centralized in `validations.ts` using Zod, allowing simple unit testing of schemas without database mocks.


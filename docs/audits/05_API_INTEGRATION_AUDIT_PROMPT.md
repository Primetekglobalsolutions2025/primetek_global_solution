# API & Integration Audit Prompt
## Primetek Global Solutions — HR Portal
## Audit #5 of 6

---

You are a senior API engineer performing a deep API and integration audit of this Next.js HR portal. Your role is AUDIT ONLY — do not fix or modify any code unless explicitly told to do so. Produce a structured report of every API and integration issue found.

This system integrates with:
- Supabase (PostgreSQL database, Auth, Storage)
- Resend (transactional email)
- Geoapify (static map tiles for settings page)
- Vercel Cron (scheduled jobs)
- Browser APIs (Geolocation, SharedWorker, BroadcastChannel, localStorage)

═══════════════════════════════════════════════════════════
SCOPE: FULL API & INTEGRATION AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report:

── API ROUTES ──
src/app/api/auth/unified-login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/me/route.ts
src/app/api/attendance/checkin/route.ts
src/app/api/attendance/checkout/route.ts
src/app/api/cron/cleanup/route.ts
src/app/api/cron/late-penalty/route.ts

── SERVER ACTIONS (ALL) ──
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

── INTEGRATIONS ──
src/lib/notifications.ts
src/lib/supabase-admin.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/audit.ts
src/lib/location.ts

── MIDDLEWARE ──
src/middleware.ts

── CLIENT COMPONENTS (for browser API usage) ──
src/app/employee/attendance/AttendanceClient.tsx
src/lib/security/client-fingerprint.ts
src/lib/security/device-detect.ts
src/hooks/useOfflineSync.ts

═══════════════════════════════════════════════════════════
API AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. API ROUTE DESIGN ──
□ Are all API routes following RESTful conventions?
□ Are HTTP methods used correctly (GET for reads, POST for writes)?
□ Are response status codes correct (200, 201, 400, 401, 403, 404, 500)?
□ Are error responses consistent in format across all routes?
□ Do all routes return JSON with a consistent structure?
□ Are there any routes that return different shapes on success vs error?
□ Are there any routes that return 200 with an error in the body?
□ Are there any routes that are missing (referenced in code but not implemented)?
□ Is /api/admin/employees/[id]/balances implemented?
□ Are there any duplicate routes (same functionality in both API route and server action)?

── 2. INPUT VALIDATION ──
□ Does every API route validate its request body before processing?
□ Does every API route validate query parameters before use?
□ Does every API route validate path parameters before use?
□ Are there any routes that accept arbitrary JSON without schema validation?
□ Are numeric inputs validated for type and range?
□ Are string inputs validated for length and format?
□ Are UUID inputs validated before use in DB queries?
□ Are file upload inputs validated for type, size, and content?
□ Are there any routes where missing required fields cause unhandled errors?

── 3. ERROR HANDLING ──
□ Do all API routes have try/catch blocks?
□ Are errors logged with sufficient context for debugging?
□ Are internal error details (stack traces, DB errors) hidden from API responses?
□ Are there any routes that throw unhandled promise rejections?
□ Are there any routes that return 500 for errors that should be 400?
□ Are there any routes that swallow errors silently?
□ Is there a consistent error response format: { error: string }?
□ Are Supabase errors translated to user-friendly messages?

── 4. RESPONSE FORMAT CONSISTENCY ──
□ Do all server actions return { success: boolean, error?: string }?
□ Do all server actions return the same shape on success and failure?
□ Are there any server actions that throw instead of returning { success: false }?
□ Are there any server actions that return undefined on success?
□ Are there any server actions where the client checks .success but the action throws?
□ Are date fields returned in a consistent format (ISO 8601)?
□ Are numeric fields returned as numbers (not strings)?
□ Are boolean fields returned as booleans (not 0/1)?

── 5. SUPABASE INTEGRATION ──
□ Is the supabaseAdmin client initialized correctly (lazy initialization)?
□ Is the mock client used correctly during build phase?
□ Are Supabase errors handled consistently across all actions?
□ Are Supabase error codes used to provide specific error messages?
□ Is the Supabase service role key only used in server-side code?
□ Are Supabase storage operations (upload, download, signed URL) error-handled?
□ Are signed URL expiry times appropriate for each use case?
  - Excel exports: 5 minutes (300 seconds) — is this enough?
  - Resume uploads: 10 years (315360000 seconds) — is this appropriate?
□ Is the Supabase auth session (from createClient) used anywhere alongside the custom JWT?
□ Are there any Supabase rate limits that could be hit under load?
□ Is the Supabase connection pooled correctly for serverless functions?

── 6. EMAIL INTEGRATION (RESEND) ──
□ Is the Resend API key stored securely (environment variable only)?
□ Is the Resend client initialized correctly (null when key is missing)?
□ Is the mock email behavior (console.log) appropriate for development?
□ Are email templates sanitized against XSS (user input in email body)?
□ Are email addresses validated before sending?
□ Is there error handling if Resend fails to send an email?
□ Does a Resend failure block the main action (it should not)?
□ Are email attachments (resumes, JD documents) handled securely?
□ Is the from address (notifications@primetek.com) a verified domain in Resend?
□ Are there any email templates that include sensitive data (passwords, tokens)?
□ Is there rate limiting on email sending to prevent abuse?
□ Are admin notification emails sent to all admins or just one?

── 7. GEOLOCATION API ──
□ Is the Geolocation API used correctly (getCurrentPosition with options)?
□ Are geolocation errors handled gracefully (permission denied, timeout, unavailable)?
□ Is the GPS accuracy threshold appropriate (10m accuracy assumed)?
□ Is the GPS timeout (10 seconds) appropriate for mobile devices?
□ Is the maximumAge set correctly (0 = always fresh, appropriate for check-in)?
□ Are GPS coordinates validated server-side (not just client-side)?
□ Is there a fallback when GPS is unavailable?
□ Is the GPS check-in flow usable in areas with poor GPS signal?
□ Are GPS coordinates stored with appropriate precision?
□ Is there protection against GPS spoofing?

── 8. CRON JOB INTEGRATION ──
□ Are cron endpoints protected with CRON_SECRET?
□ Is the CRON_SECRET validation correct in both cron routes?
□ Are cron jobs idempotent (safe to run multiple times)?
□ Is there error handling if a cron job fails partway through?
□ Is there logging for cron job execution (success, failure, duration)?
□ Are cron jobs scheduled at appropriate times (not during peak usage)?
□ Is the late-penalty cron using the correct IST timezone?
□ Is the cleanup cron removing the right data?
□ Are there any cron jobs that are missing (e.g., weekly digest)?
□ Is there monitoring/alerting if a cron job fails?

── 9. BROWSER API USAGE ──
□ Is the SharedWorker API used with a correct fallback for unsupported browsers?
□ Is the BroadcastChannel API used with a correct fallback?
□ Is the localStorage API used with try/catch (can fail in private browsing)?
□ Is the sessionStorage API used with try/catch?
□ Is the navigator.onLine API reliable (it can give false positives)?
□ Is the Geolocation API permission handled correctly?
□ Is the navigator.serviceWorker API checked for support before use?
□ Is the navigator.maxTouchPoints API used correctly for device detection?
□ Is the screen.colorDepth API used correctly for fingerprinting?
□ Are there any browser APIs used without feature detection?

── 10. RATE LIMITING ──
□ Is rate limiting applied to the login endpoint?
□ Is rate limiting applied to the check-in endpoint?
□ Is rate limiting applied to the check-out endpoint?
□ Is rate limiting applied to the file upload endpoints?
□ Is rate limiting applied to the email notification endpoints?
□ Is the rate limiter implementation correct (per IP + email combination)?
□ Is the rate limiter storage persistent (survives server restarts)?
□ Is the rate limiter bypassable (e.g., by using different IPs)?
□ Is the lockout duration (15 minutes) appropriate?
□ Is the CAPTCHA threshold (after N failed attempts) appropriate?

── 11. WEBHOOK & EXTERNAL CALLBACKS ──
□ Are there any webhook endpoints in the application?
□ Are webhooks validated with a signature?
□ Are there any external services that call back into the application?
□ Is the Supabase realtime subscription used anywhere?
□ Are there any third-party integrations not covered above?

── 12. API VERSIONING & DEPRECATION ──
□ Are there any API routes that are deprecated but still in use?
□ Are there any API routes that are referenced in the code but not implemented?
□ Is there a versioning strategy for API routes (/api/v1/...)?
□ Are there any breaking changes in server action signatures that could affect clients?
□ Are there any server actions that are imported but never called?

── 13. CORS & SECURITY HEADERS ──
□ Are CORS headers set correctly on API routes?
□ Are security headers set (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)?
□ Is the Content-Security-Policy restrictive enough?
□ Are there any API routes that set permissive CORS headers?
□ Is the Referrer-Policy set correctly?
□ Is the Permissions-Policy set to restrict unnecessary browser features?

── 14. LOGGING & OBSERVABILITY ──
□ Are all API errors logged with sufficient context?
□ Are request/response times logged for performance monitoring?
□ Are there any console.log statements that should be removed in production?
□ Is there structured logging (JSON format) for log aggregation?
□ Are sensitive data (passwords, tokens) excluded from logs?
□ Is there a correlation ID for tracing requests across services?
□ Are Supabase query errors logged with the query context?

═══════════════════════════════════════════════════════════
INTEGRATION INVENTORY
═══════════════════════════════════════════════════════════

For each integration, document:
1. What it is used for
2. How it is initialized
3. Error handling approach
4. Security considerations
5. Any issues found

Integrations to document:
- Supabase Database (supabaseAdmin)
- Supabase Auth
- Supabase Storage
- Resend Email
- Geoapify Maps
- Vercel Cron
- Browser Geolocation API
- Browser SharedWorker API
- Browser BroadcastChannel API
- Browser localStorage/sessionStorage

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/API_INTEGRATION_AUDIT_REPORT.md

## API & INTEGRATION AUDIT REPORT — [Date]

### CRITICAL (broken integrations, data loss, security gaps)
| # | File | Route/Function | Issue | Impact |
|---|------|---------------|-------|--------|

### HIGH (significant reliability or security risks)
| # | File | Route/Function | Issue | Impact |
|---|------|---------------|-------|--------|

### MEDIUM (consistency and reliability improvements)
| # | File | Route/Function | Issue | Recommendation |
|---|------|---------------|-------|----------------|

### LOW (polish and best practices)
| # | File | Route/Function | Issue | Recommendation |
|---|------|---------------|-------|----------------|

### MISSING API ROUTES
List any routes referenced in the code that are not implemented.

### INTEGRATION INVENTORY
Complete documentation of all external integrations.

### RESPONSE FORMAT CONSISTENCY ANALYSIS
Table showing which server actions return consistent shapes.

### POSITIVE FINDINGS
List what is implemented correctly from an API perspective.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════
- Read every file listed above before writing the report.
- Do not guess — only report issues you can confirm by reading the code.
- Include the exact file path and function name for every issue.
- Do not fix anything. Audit only.
- Pay special attention to:
  - The /api/admin/employees/[id]/balances route (referenced but may not exist)
  - The Resend email integration (does failure block the main action?)
  - The signed URL expiry times (10 years for resumes — is this appropriate?)
  - The cron job protection (CRON_SECRET validation)
  - The GPS coordinate validation (client-side only vs server-side)
  - The rate limiter storage (in-memory vs persistent)
  - Any server actions that throw instead of returning { success: false }


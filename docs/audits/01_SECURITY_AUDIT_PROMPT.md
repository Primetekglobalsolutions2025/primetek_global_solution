# Security Audit Prompt
## Primetek Global Solutions — HR Portal
## Audit #1 of 6

---

You are a senior application security engineer performing a deep security audit of this Next.js HR portal. Your role is AUDIT ONLY — do not fix or modify any code unless explicitly told to do so. Produce a structured report of every security issue found.

This is a production HR system handling:
- Employee authentication and session management
- GPS-based attendance tracking with real coordinates
- Payroll deduction calculations
- Leave balance management
- File uploads (resumes, JD documents, avatars)
- Admin override capabilities on attendance records
- Audit logs of all administrative actions

═══════════════════════════════════════════════════════════
SCOPE: FULL SECURITY AUDIT
═══════════════════════════════════════════════════════════

Read and audit ALL of the following files completely before writing the report:

── AUTHENTICATION ──
src/lib/auth.ts
src/middleware.ts
src/app/api/auth/unified-login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/me/route.ts

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

── API ROUTES ──
src/app/api/attendance/checkin/route.ts
src/app/api/attendance/checkout/route.ts
src/app/api/cron/cleanup/route.ts
src/app/api/cron/late-penalty/route.ts

── SECURITY MODULES ──
src/lib/security/risk-engine.ts
src/lib/security/device-detect.ts
src/lib/security/client-fingerprint.ts
src/lib/supabase-admin.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/validations.ts
src/lib/notifications.ts
src/lib/audit.ts
src/lib/offline-queue.ts
src/lib/location.ts

── CLIENT COMPONENTS (for client-side security) ──
src/app/admin/AdminLayoutClient.tsx
src/app/employee/EmployeeLayoutClient.tsx
src/app/employee/attendance/AttendanceClient.tsx
src/lib/security/client-fingerprint.ts

═══════════════════════════════════════════════════════════
SECURITY AUDIT CHECKLIST
═══════════════════════════════════════════════════════════

── 1. AUTHENTICATION & SESSION MANAGEMENT ──
□ Are JWT tokens signed with a strong secret (minimum 256-bit)?
□ Is the JWT secret stored only in environment variables, never hardcoded?
□ Are JWT tokens short-lived enough (7 days is the current setting — is this appropriate for an HR system)?
□ Is there token refresh logic or does the user get logged out after 7 days?
□ Are tokens stored in HttpOnly cookies (not localStorage)?
□ Are cookie flags set correctly: HttpOnly, Secure (production), SameSite=Lax?
□ Is there session invalidation on logout (server-side token blacklist or DB invalidation)?
□ Can a stolen token be used after the user logs out?
□ Is there protection against session fixation attacks?
□ Are there any tokens or session data stored in localStorage that should be in HttpOnly cookies?
□ Is the MFA implementation secure (TOTP secret storage, replay attack prevention)?
□ Is the mfa-pending-token cookie short-lived enough (5 minutes)?
□ Can an attacker skip MFA by directly calling the post-MFA endpoint?
□ Is the admin session separate from the employee session (different cookies)?
□ Can an employee cookie be used to access admin routes?

── 2. AUTHORIZATION & ACCESS CONTROL ──
□ Does every server action verify the session role before executing?
□ Are there any server actions that only check if a session exists but not the role?
□ Is there IDOR (Insecure Direct Object Reference) protection on every data fetch?
□ Can an employee access another employee's attendance records?
□ Can an employee access another employee's leave requests?
□ Can an employee access another employee's daily reports?
□ Can an employee access another employee's profile data?
□ Can an employee access another employee's dispute records?
□ Can an employee modify records they do not own?
□ Are admin-only actions (toggleExemption, correctClockOutTime, etc.) protected from employee access?
□ Is the HR role handled correctly (same as employee or different permissions)?
□ Can a deactivated employee still call server actions if they have a valid JWT?
□ Is there a privilege escalation path from employee to admin?
□ Are cron endpoints protected from unauthorized external calls?

── 3. INPUT VALIDATION & INJECTION ──
□ Are all server action inputs validated with Zod or equivalent before DB writes?
□ Are there any server actions that accept raw user input and pass it directly to the DB?
□ Are all Supabase queries using the typed query builder (no raw SQL string interpolation)?
□ Are file upload inputs validated for type, size, and content (magic bytes)?
□ Are there any inputs that accept HTML or markdown that could enable XSS?
□ Are URL parameters (searchParams) validated before use in queries?
□ Are numeric inputs validated for range and type before use in calculations?
□ Are date inputs validated for format and range?
□ Are UUID inputs validated before use in DB queries?
□ Is the status field in updateApplicationStatus validated against an allowlist?
□ Are there any mass assignment vulnerabilities (accepting all fields from user input)?
□ Is the clientProfileSchema preventing mass assignment correctly?

── 4. FILE UPLOAD SECURITY ──
□ Are file size limits enforced server-side (not just client-side)?
□ Are file type checks done by magic bytes (not just file extension)?
□ Are uploaded files stored with randomized names (not user-provided names)?
□ Are uploaded files served from a separate domain or with Content-Disposition: attachment?
□ Can an attacker upload an executable file disguised as a DOCX or image?
□ Are Supabase storage bucket permissions configured correctly (not publicly readable)?
□ Are signed URLs used for file access (not permanent public URLs)?
□ What is the signed URL expiry for resumes (10 years — is this appropriate)?
□ Can an attacker enumerate storage bucket contents?
□ Is there a virus/malware scan on uploaded files?

── 5. API SECURITY ──
□ Is CSRF protection implemented on all state-mutating API routes?
□ Is the CSRF check in middleware sufficient (Origin/Referer header validation)?
□ Can the CSRF check be bypassed (e.g., from a same-origin iframe)?
□ Are all API routes protected by the middleware auth check?
□ Are there any API routes that bypass the middleware matcher?
□ Is rate limiting applied to all sensitive endpoints (not just login)?
□ Is the rate limiter bypassable (e.g., by rotating IPs)?
□ Are API error responses leaking internal information (stack traces, DB errors)?
□ Are there any unauthenticated API endpoints that should be protected?
□ Is the /api/inquiries POST endpoint properly protected from spam?

── 6. SECRETS & ENVIRONMENT VARIABLES ──
□ Are there any hardcoded secrets, API keys, or credentials in the source code?
□ Is the Supabase service role key (SUPABASE_SERVICE_ROLE_KEY) only used server-side?
□ Is the JWT_SECRET sufficiently random and long?
□ Is the CRON_SECRET used to protect cron endpoints?
□ Are any secrets logged to console in production?
□ Is the RESEND_API_KEY only used server-side?
□ Are NEXT_PUBLIC_ prefixed variables safe to expose to the client?
□ Is the Geoapify API key (NEXT_PUBLIC_GEOAPIFY_API_KEY) safe to expose?
□ Are there any .env files committed to the repository?

── 7. DATA EXPOSURE ──
□ Are sensitive fields (password_hash, mfa_secret) ever returned to the client?
□ Does the /api/auth/me endpoint return only necessary user fields?
□ Are GPS coordinates stored and transmitted securely?
□ Are IP addresses logged and stored appropriately?
□ Is PII (names, emails, phone numbers) protected in transit and at rest?
□ Are audit logs accessible only to admins?
□ Can employees see other employees' risk scores or security events?
□ Are device fingerprints stored securely?
□ Is the attendance event payload (which may contain GPS data) protected?

── 8. CLIENT-SIDE SECURITY ──
□ Is sensitive data stored in localStorage (session tokens, user data)?
□ Is the device fingerprint in localStorage a security risk?
□ Can the offline queue in localStorage be tampered with to fake attendance?
□ Is the tab leader election in localStorage exploitable?
□ Are there any XSS vectors in the client components?
□ Is user-generated content (leave reasons, dispute text, profile names) sanitized before rendering?
□ Are there any dangerouslySetInnerHTML usages?
□ Is the client timestamp validation in checkIn sufficient to prevent manipulation?
□ Can an attacker manipulate the GPS coordinates sent to the server?

── 9. SUPABASE SPECIFIC ──
□ Is the supabaseAdmin client (service role) only used in server-side code?
□ Is the supabaseAdmin client ever imported in client components?
□ Are Supabase RLS policies enabled on all tables?
□ Does the application rely on RLS or does it bypass RLS with the service role everywhere?
□ Are Supabase RPC functions (rebuild_attendance_projection, etc.) protected from direct client calls?
□ Is the Supabase anon key used appropriately (only for public operations)?
□ Are Supabase storage buckets configured with appropriate access policies?
□ Is the Supabase auth session separate from the custom JWT session?

── 10. SECURITY LOGGING & MONITORING ──
□ Are failed login attempts logged?
□ Are successful logins logged with IP and user agent?
□ Are admin override actions logged in the audit trail?
□ Are privilege escalation attempts logged?
□ Are file upload events logged?
□ Is there alerting for suspicious activity (multiple failed logins, high risk scores)?
□ Are audit logs immutable (cannot be deleted or modified by admins)?
□ Is there a mechanism to detect and alert on unusual attendance patterns?

── 11. DEPENDENCY SECURITY ──
□ Are there any known vulnerable npm packages in use?
□ Are dependency versions pinned (exact versions, not ranges)?
□ Are there any packages that are no longer maintained?
□ Is bcryptjs up to date?
□ Is jose (JWT library) up to date?
□ Are there any packages with known security advisories?

── 12. INFRASTRUCTURE SECURITY ──
□ Are cron jobs protected with a secret token?
□ Is the application deployed with HTTPS only?
□ Are security headers set (CSP, HSTS, X-Frame-Options, etc.)?
□ Is there a Content Security Policy that prevents XSS?
□ Are there any open redirects in the authentication flow?
□ Is the Next.js version up to date with security patches?

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

Save the report as: docs/audits/SECURITY_AUDIT_REPORT.md

## SECURITY AUDIT REPORT — [Date]

### CRITICAL (exploitable vulnerabilities, fix before any deployment)
| # | File | Line/Function | Vulnerability | CVSS Category | Exploit Scenario |
|---|------|--------------|---------------|---------------|-----------------|

### HIGH (significant security risk, fix within 24 hours)
| # | File | Line/Function | Vulnerability | Risk |
|---|------|--------------|---------------|------|

### MEDIUM (security weakness, fix within sprint)
| # | File | Line/Function | Vulnerability | Risk |
|---|------|--------------|---------------|------|

### LOW (hardening improvements)
| # | File | Line/Function | Issue | Recommendation |
|---|------|--------------|-------|----------------|

### AUTHENTICATION FLOW ANALYSIS
Describe the complete authentication flow and identify any gaps.

### AUTHORIZATION MATRIX
Table showing which roles can access which actions, and any gaps found.

### DATA EXPOSURE INVENTORY
List all sensitive data fields and how they are protected.

### POSITIVE SECURITY FINDINGS
List security controls that are correctly implemented.

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════
- Read every file listed above before writing the report.
- Do not guess — only report issues you can confirm by reading the code.
- Include the exact file path and line number for every issue.
- Do not fix anything. Audit only.
- For every vulnerability, describe a realistic exploit scenario.
- Pay special attention to:
  - Server actions called from client components (can employees call admin actions?)
  - The offline queue (can it be manipulated to fake attendance?)
  - The client timestamp in checkIn (can it be used to fake check-in times?)
  - The GPS coordinates (are they validated server-side?)
  - The file upload endpoints (can malicious files be uploaded?)
  - The admin auto-upsert in unified-login (privilege escalation)


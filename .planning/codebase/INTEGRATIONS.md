# External Integrations

**Analysis Date:** 2026-05-28

## APIs & External Services

**Email Notifications:**
- **Resend** - Transactional notification emails (leave applications, WFH approvals, candidate interview schedules).
  - SDK/Client: `resend` npm package (v6.12.2).
  - Auth: API key stored in the `RESEND_API_KEY` environment variable.
  - Templates: Generated dynamically in inline TSX helper files (e.g., `@/lib/notifications`).

**Web Analytics & Tracking:**
- **Google Analytics 4** - Website visitor telemetry and page view tracking.
  - Integration method: Inline Google Tag script (`afterInteractive` loading strategy).
  - Auth: Tracking ID configured in `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- **Microsoft Clarity** - Session recordings and user heatmaps.
  - Integration method: Inline Clarity JavaScript snippet.
  - Auth: Project ID configured in `NEXT_PUBLIC_CLARITY_PROJECT_ID`.

## Data Storage

**Databases:**
- **PostgreSQL on Supabase** - Master relational storage for employees, attendance ledger, and system state.
  - SDK/Client: Direct database execution via Supabase API Client, triggers, and PL/pgSQL migrations.
  - Connection: Via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side interactions, and `SUPABASE_SERVICE_ROLE_KEY` for server-side administrative overrides.
  - Migrations: Handled sequentially using raw SQL migration files located in `supabase/migrations/`.

**File Storage:**
- **Supabase Storage** - Upload and retrieval of candidate resumes and generated spreadsheets.
  - Client: Supabase client-storage SDK.
  - Buckets:
    - `resumes` - Storage for candidate resumes uploaded in recruitment pipelines.
    - `exports` - Staging area for spreadsheets exported by administrators.

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** - Email/Password session auth.
  - Implementation: `@supabase/ssr` helper library for unified cookie-based session hydration and authentication middleware checks.
  - Token storage: Client-side cookies and secure tokens.
  - Session verification: Handled globally via Next.js middleware routing.

**Multi-Factor Authentication (MFA):**
- **TOTP (Time-Based One-Time Password)** - Required secondary security layers for administrative portals.
  - Implementation: Generates cryptographically secure secrets via the `otplib` package.
  - QR Code: Renders setup codes in-client using the `qrcode` package.

## CI/CD & Deployment

**Hosting:**
- **Vercel** - Production and staging hosting for Next.js routes and serverless execution.
  - Deployment: Auto-triggered on git pushes to the `main` branch.
  - Environment Configuration: Managed directly in the Vercel dashboard.

---

*Integration audit: 2026-05-28*
*Update when adding/removing external services*

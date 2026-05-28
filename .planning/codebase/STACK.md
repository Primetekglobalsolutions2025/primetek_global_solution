# Technology Stack

**Analysis Date:** 2026-05-28

## Languages

**Primary:**
- TypeScript 5.x - All application frontend, backend API routes, and Server Actions.

**Secondary:**
- SQL (PL/pgSQL) - Supabase migrations, table definitions, row-level security (RLS) policies, and event-sourcing triggers.
- JavaScript - Build and configuration tooling.

## Runtime

**Environment:**
- Node.js 20.x or higher (LTS) - Server-side rendering (SSR), API router, and Server Actions.
- Modern Web Browsers - Progressive Web App (PWA) client-side execution, geofencing, and telemetry tracking.

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present.

## Frameworks

**Core:**
- Next.js 16.2.4 (App Router) - Full-stack framework (SSR, dynamic routing, Middleware/Proxy).
- React 19.2.4 - Component-based client library.
- Tailwind CSS v4 - Styling system.

**Testing:**
- Currently unconfigured (testing is conducted manually or via runtime logs).

**Build/Dev:**
- Turbopack / Next Compiler - Bundling and optimization.
- TypeScript compiler (`tsc`) - Static type validation.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.105.0 - Supabase integration (real-time subscriptions, client, database access).
- `@supabase/ssr` 0.10.2 - SSR authentication and session management.
- `bcryptjs` 3.0.3 - Password hashing for legacy portals.
- `otplib` 13.4.0 - MFA TOTP token authentication.
- `qrcode` 1.5.4 - QR code rendering for MFA setup.

**Infrastructure:**
- `rate-limiter-flexible` 11.0.1 - Rate limiting for API authentication endpoints.
- `resend` 6.12.2 - Email notifications for leave requests and WFH approvals.
- `exceljs` 4.4.0 - Spreadsheet generation for administrative exports.
- `framer-motion` 12.38.0 & `gsap` 3.15.0 - High-fidelity visual transitions, glassmorphic animations, and UI polish.

## Configuration

**Environment:**
- Configured via `.env.local`, `.env.development.local`, and `.env.production.local` files.
- **Key Variables:**
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public coordinates.
  - `SUPABASE_SERVICE_ROLE_KEY` - Admin database bypassing token.
  - `RESEND_API_KEY` - Email client token.
  - `NEXT_PUBLIC_SITE_URL` - Canonical URL.

**Build:**
- `next.config.ts` - Next.js config parameters.
- `tsconfig.json` - TypeScript compile settings.
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS.

## Platform Requirements

**Development:**
- Cross-platform (Windows, macOS, Linux).
- Requires Node.js and access to a Supabase project instance.

**Production:**
- Deployment on Vercel (Next.js serverless functions).
- Supabase (hosted PostgreSQL instance with database functions and triggers enabled).

---

*Stack analysis: 2026-05-28*
*Update after major dependency changes*

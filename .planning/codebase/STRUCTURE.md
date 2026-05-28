# Codebase Structure

**Analysis Date:** 2026-05-28

## Directory Layout

```
primetek_global_solution-main/
├── .planning/             # GSD implementation plan, roadmap, and codebase maps
├── public/                # Static assets (images, icons, PWA manifests)
├── src/                   # Main source code directory
│   ├── app/               # Next.js App Router routes, layouts, and API endpoints
│   │   ├── (public)/      # Public/authenticated entry (login, register)
│   │   ├── admin/         # Administrative portal dashboard and sub-pages
│   │   ├── employee/      # Employee portal dashboard and actions
│   │   └── api/           # Serverless API routes (auth, attendance, MFA, cron)
│   ├── components/        # Reusable React components
│   │   ├── admin/         # Admin-specific panels and tables
│   │   ├── employee/      # Employee-specific punch clocks, forms, and cards
│   │   ├── auth/          # Login and MFA wizard inputs
│   │   ├── pwa/           # Sidebar, install prompts, and installation banners
│   │   └── ui/            # Base UI design components (buttons, dialogs, status tags)
│   ├── hooks/             # Custom React Hooks
│   ├── lib/               # Shared business logic and external services
│   │   ├── security/      # Zero-Trust network, fingerprinting, and risk engine
│   │   └── supabase/      # Supabase clients for server and client scopes
│   ├── styles/            # Tailwind theme tokens and configurations
│   └── middleware.ts      # Authentication guard and geofencing routing
└── supabase/              # Database schema migrations and scripts
    └── migrations/        # SQL DDL/DML event-sourced schema files
```

## Directory Purposes

**src/app/**
- Purpose: Application routing, layouts, page components, and Server Actions.
- Contains: Layouts (`layout.tsx`), page handlers (`page.tsx`), serverless handlers (`route.ts`), and route configurations.
- Key files: `layout.tsx` (global viewport/PWA wrapper), `middleware.ts` (global session interceptor).
- Subdirectories: `(public)/` (public/landing), `admin/` (administrator panel), `employee/` (employee panel), `api/` (rest endpoints).

**src/components/**
- Purpose: Isolated, modular frontend view components.
- Contains: React components with Tailwind styling and animations.
- Key files: `pwa/AppSidebar.tsx` (collapsible viewport panel), `employee/PunchClock.tsx` (attendance operations), `admin/AuditTrailTable.tsx` (audit query visuals).
- Subdirectories: `admin/`, `employee/`, `auth/`, `layout/`, `profile/`, `pwa/`, `sections/`, `ui/`.

**src/lib/**
- Purpose: Backend interfaces, third-party libraries, validations, and security utilities.
- Contains: TypeScript utility files.
- Key files: `lib/auth.ts` (session & MFA validations), `lib/notifications.ts` (Resend integration), `lib/rate-limit.ts` (brute-force defense), `lib/validations.ts` (Zod schemas).
- Subdirectories: `security/` (fingerprinting/risk engine), `supabase/` (authenticated client initializers).

**src/hooks/**
- Purpose: Stateful client-side operations (e.g. offline synchronization).
- Contains: React hooks.
- Key files: `useOfflineSync.ts` (handles IndexDB local staging and Supabase replay queues).

**supabase/migrations/**
- Purpose: Database schemas, migrations, policies, and procedural triggers.
- Contains: SQL migrations in version-ordered naming.
- Key files: `20260528100000_disable_heartbeat_sweep_and_fix_resumption.sql` (disables background worker heartbeats and fixes session resumption).

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML layout containing font settings, service worker registers, and PWA setup.
- `src/middleware.ts`: Geofencing verification, session decoding, and redirect gatekeeper.

**Configuration:**
- `package.json`: Project manifest and package dependencies.
- `next.config.ts`: Next.js compiler parameters.
- `tsconfig.json`: TypeScript static compiler target settings.
- `postcss.config.mjs`: Tailwind CSS integration.

**Core Logic:**
- `src/lib/auth.ts`: Password validation, session parsing, and authentication core.
- `src/lib/security/risk-engine.ts`: Calculates network-trust and browser-fingerprint security flags.
- `src/lib/offline-queue.ts`: Intercepts failed network requests during offline states.

**Database Migrations:**
- `supabase/migrations/`: Sequential SQL files.
- `supabase/run_all_pending_migrations.sql`: Combines SQL migrations for local development setup.

## Naming Conventions

**Files:**
- `PascalCase.tsx`: React components (e.g., `PunchClock.tsx`, `AppSidebar.tsx`).
- `kebab-case.ts`: General source scripts, services, and configs (e.g., `client-fingerprint.ts`, `rate-limit.ts`).
- `useCamelCase.ts`: React hooks (e.g., `useOfflineSync.ts`).
- `page.tsx` / `layout.tsx` / `route.ts`: Next.js specific files.
- `YYYYMMDDHHMMSS_name.sql`: Supabase migrations.

**Directories:**
- `kebab-case`: General modules and routes (e.g., `debug-query`, `offline-queue`).
- `(parentheses)`: Next.js route groups (e.g., `(public)`).

## Where to Add New Code

**New Feature (Routing & View):**
- Routing: `src/app/[role]/[feature-name]/page.tsx`
- Layout variations: `src/app/[role]/[feature-name]/layout.tsx`
- Component: `src/components/[role]/[ComponentName].tsx`

**New API Endpoint:**
- Router: `src/app/api/[module]/[action]/route.ts`
- Schema Validations: `src/lib/validations.ts`

**Shared Service / Utilities:**
- Helper code: `src/lib/[service-name].ts`
- Environment config checks: `src/lib/env.ts`

**Database Changes:**
- SQL Migration: Create a new file under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`

## Special Directories

**node_modules/**
- Purpose: Third-party library assets downloaded by npm.
- Committed: No (listed in `.gitignore`).

**.next/**
- Purpose: Optimized production build output by next build compiler.
- Committed: No (listed in `.gitignore`).

**.planning/**
- Purpose: GSD workflow status tracking and codebase maps.
- Committed: Yes (source of truth for project state).

**.code-review-graph/**
- Purpose: SQLite database and files for local code graph generation.
- Committed: No (listed in `.gitignore`).

---

*Structure analysis: 2026-05-28*
*Update when directory structure changes*

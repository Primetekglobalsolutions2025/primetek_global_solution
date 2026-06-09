# Project Folder Structure Blueprint

This document serves as the definitive reference guide for codebase organization, directory structure, file placement, and naming conventions within the **Primetek Global Solution** workspace.

---

## 1. Structural Overview

The Primetek project is organized as a unified monorepo containing three core systems:
1. **Next.js Web Portal** (`src/`): A modern Web application built using Next.js 16 (App Router), React 19, TailwindCSS v4, and Radix primitives.
2. **Supabase Database Engine** (`supabase/`): Holds all relational database schemas, triggers, triggers for event-sourcing, Row Level Security (RLS) policies, and helper SQL migrations.
3. **Chrome Extension Tracker** (`chrome-extension/`): A lightweight extension that runs on the employee's machine, syncing auth sessions automatically and reporting heartbeat telemetry.

### Organizational Principles
- **Separation by Role and Audience**: Routing directories inside Next.js (`src/app`) and component structures are strictly split into `admin` and `employee` namespaces. This enforces boundaries and minimizes accidental leakages of admin components to standard clients.
- **Incremental Database Schema Evolution**: All database schemas are version-controlled chronologically in `supabase/migrations/` using timestamped SQL scripts.
- **Consolidated Documentation**: All audit sheets, technical guidelines, design documentation, and logs are centralized under `docs/` to maintain a clutter-free project root.

---

## 2. Directory Visualization

Below is the directory hierarchy structure mapped to depth level 3:

```
primetek_global_solution-main/
├── .agents/                            # Local agent execution profiles and installed tools
├── .github/                            # CI/CD and deployment workflows
├── .planning/                          # Workspace milestones, tasks, and state trackers
├── chrome-extension/                   # Local client Chrome extension
│   ├── background.js                   # Extension telemetry sync worker
│   ├── popup.html                      # Compact UI popup window
│   ├── popup.js                        # User interaction controller
│   ├── styles.css                      # Custom layout stylesheet
│   └── manifest.json                   # Chrome extension v3 manifest
├── docs/                               # Central project documentation
│   ├── audits/                         # Security, database, and UX audit reports
│   │   ├── SECURITY_AUDIT_REPORT.md
│   │   ├── DATABASE_AUDIT_REPORT.md
│   │   └── UI_UX_AUDIT_REPORT.md
│   ├── design/                         # Architecture, UI/UX guidelines, and progress logs
│   │   ├── DESIGN.md
│   │   ├── IMPROVEMENTS.md
│   │   └── PROGRESS.md
│   └── SERVER_ACTIONS.md               # Backend API and server workflow documentation
├── e2e/                                # End-to-End browser test suites
│   ├── auth.spec.ts                    # Authentication flows testing
│   ├── dashboard.spec.ts               # Dashboard layout and interaction testing
│   └── helpers/                        # Playwright custom commands and mocks
├── google-sheets/                      # Google Apps Script configurations and integrations
│   ├── google-sheets-script.js         # Standard spreadsheets sheet-to-sheet sync script
│   └── improved-script.gs              # Modularized batch cache sync script
├── public/                             # Client-side static assets
│   ├── icons/                          # PWA icons and app logo versions
│   └── manifest.json                   # Progressive Web App configuration file
├── src/                                # Main Next.js portal application
│   ├── __tests__/                      # Vitest unit test suites
│   ├── app/                            # App Router layouts and routes
│   │   ├── (public)/                   # Unauthenticated landing page and login routing
│   │   ├── admin/                      # Administrator-facing views and actions
│   │   ├── employee/                   # Employee dashboard, checkins, and claims
│   │   └── api/                        # Route Handlers / API endpoints
│   ├── components/                     # Shared React components (UI/UX)
│   │   ├── ui/                         # Atomic, generic design primitives (buttons, inputs)
│   │   ├── admin/                      # Admin dashboard components
│   │   ├── employee/                   # Employee status panels, claim tables
│   │   ├── auth/                       # Credentials forms and MFA verification UI
│   │   └── layout/                     # Sidebar headers, footers, wrappers
│   ├── hooks/                          # Custom React hook utilities (useAuth, useLocalStorage)
│   ├── lib/                            # Integrations and helpers
│   │   ├── supabase/                   # Supabase clients (SSR, client, service-role)
│   │   └── validations.ts              # Zod validation schemas
│   ├── styles/                         # Custom CSS style stylesheets
│   └── middleware.ts                   # Role-based route guard and cookie verification
└── supabase/                           # Supabase configuration workspace
    └── migrations/                     # Chronological SQL migrations and schema definitions
```

---

## 3. Key Directory Analysis

### UI Project Structure (`src/`)

- **Component Grouping**: Split strictly by domain (e.g., `components/admin/`, `components/employee/`, `components/auth/`). Generic primitives live in `components/ui/` and must remain completely decoupled from business models.
- **State Management**: Authentication state is stored globally in Supabase sessions and verified using Next.js `middleware.ts`. Feature states and data fetching are handled client-side using React context hooks or local component states.
- **Routing Organization**: Done through file-based App Router nesting. Sub-pages are grouped within dynamic layouts that load role permissions prior to rendering children.

### Database Workspaces (`supabase/`)

- **Incremental Migration Format**: Files are placed under `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`.
- **Row Level Security (RLS)**: Policies are written in SQL and associated with user roles (`authenticated`, `anon`, `service_role`).

---

## 4. File Placement Patterns

| File Type / Content | Destination Path | Naming/Style Conventions |
| :--- | :--- | :--- |
| **New Routing Views** | `src/app/[role]/[path]/page.tsx` | Must contain SEO-ready metadata and custom error boundary components |
| **Atomic Components** | `src/components/ui/` | kebab-case (e.g., `slider.tsx`, `sheet.tsx`) |
| **Business Components**| `src/components/[domain]/` | PascalCase (e.g., `EmployeeDashboard.tsx`) |
| **Zod Schemas** | `src/lib/validations.ts` | suffix with `Schema` (e.g., `loginSchema`) |
| **Custom React Hooks**| `src/hooks/` | camelCase prefixed with `use` (e.g., `useTelemetry.ts`) |
| **SQL Migrations** | `supabase/migrations/` | timestamped prefix (e.g., `20260604020000_job_tracker_univer_sheets.sql`) |

---

## 5. Naming and Organization Conventions

- **Case Formats**:
  - **Directories**: kebab-case (e.g., `chrome-extension`, `google-sheets`, `components/layout`).
  - **React Components**: PascalCase (e.g., `Button.tsx`, `JobTrackerList.tsx`).
  - **Helper Functions / Hooks**: camelCase (e.g., `cn`, `useAuth`).
  - **SQL Tables / Columns**: snake_case (e.g., `job_tracker_sheets`).
- **Imports**: Clean absolute import paths must be used, resolving via typescript alias path configurations:
  - `@/components/*` maps to `src/components/*`
  - `@/lib/*` maps to `src/lib/*`
  - `@/hooks/*` maps to `src/hooks/*`

---

## 6. Navigation and Development Workflow

### Entry Points
- **Next.js Entry**: `src/app/layout.tsx` (Global layout configuration)
- **Chrome Extension Entry**: `chrome-extension/manifest.json` and `chrome-extension/background.js`
- **Database Entry**: `supabase/migrations/20260501000000_schema.sql` (Initial base database schemas)

### Common Development Tasks
- **Adding a new Employee view**:
  1. Add a route folder under `src/app/employee/[feature_name]/page.tsx`.
  2. Put feature-specific logic in `src/components/employee/[feature_name]Component.tsx`.
  3. Ensure role clearance is checked via `src/middleware.ts`.
- **Creating a database model change**:
  1. Generate a new migration script using the timestamp naming format under `supabase/migrations/`.
  2. Test the SQL scripts locally.
  3. Update typescript types or validations under `src/lib/validations.ts`.

---

## 7. Structure Templates

### New App Router Page Template
```tsx
import { Metadata } from 'next';
import { Suspense } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

export const metadata: Metadata = {
  title: 'Feature Name | Primetek Portal',
  description: 'Detailed description of the feature view.',
};

export default async function FeaturePage() {
  return (
    <main className="w-full max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Feature Title</h1>
      <Suspense fallback={<LoadingSpinner />}>
        {/* Render child components here */}
      </Suspense>
    </main>
  );
}
```

### New UI Component Template
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const CustomInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
CustomInput.displayName = 'CustomInput';

export { CustomInput };
```

---

## 8. Structure Enforcement

Compliance with this structure is enforced via:
1. **ESLint Configurations**: Rules defined in `eslint.config.mjs` checking import sorting, naming, and dead code.
2. **TypeScript Compilation Check**: Block check in production builds:
   ```bash
   npx tsc --noEmit
   ```
3. **Vitest Unit Checks**: Continuous Integration (CI) test execution runner:
   ```bash
   npm run test
   ```

---

*This blueprint was auto-generated in June 2026 based on the project structures and guidelines defined in the Primetek Global Solution workspace. Please update this document if folders or structural namespaces evolve.*

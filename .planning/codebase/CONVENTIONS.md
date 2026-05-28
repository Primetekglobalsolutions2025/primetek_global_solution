# Coding Conventions

**Analysis Date:** 2026-05-28

## Naming Patterns

**Files:**
- `PascalCase.tsx`: React frontend components (e.g., `PunchClock.tsx`).
- `kebab-case.ts`: Utility services, validators, config files, and hooks (e.g., `client-fingerprint.ts`, `rate-limit.ts`).
- `useCamelCase.ts`: Custom React hooks (e.g., `useOfflineSync.ts`).
- `page.tsx` / `layout.tsx` / `route.ts`: Standard Next.js route entry points.
- `YYYYMMDDHHMMSS_name.sql`: SQL migration files under `supabase/migrations/`.

**Functions:**
- `camelCase` for TypeScript and JavaScript functions (e.g., `verifyActiveSession`, `createToken`).
- Event handlers in components: prefixed with `handle` (e.g., `handleClockIn`, `handleSubmit`).
- PL/pgSQL functions: lowercase with snake_case (e.g., `sweep_and_close_stale_sessions`, `rebuild_attendance_projection`).

**Variables:**
- `camelCase` for general variables.
- `UPPER_SNAKE_CASE` for file/global constants (e.g., `JWT_SECRET`, `MAX_RETRIES`).
- Private or cached variables inside modules: prefixed with an underscore `_` (e.g., `_jwtSecret`, `_captchaKey`).
- PL/pgSQL variables: prefixed with `v_` (e.g., `v_stale`, `v_next_seq`), and parameter arguments prefixed with `p_` (e.g., `p_session_id`).

**Types:**
- `PascalCase` for Interfaces and type definitions, without prefixing (e.g., `TokenPayload`, `FingerprintData`).
- `PascalCase` for Enums and upper-case values (if used).

## Code Style

**Formatting:**
- Indentation: 2 spaces for TypeScript/React code, 4 spaces for PL/pgSQL database scripts.
- Single quotes `'` for JavaScript/TypeScript strings, except for TSX templates or templates with variables.
- Semicolons: Required at the end of statements in TypeScript.
- Line limit: 120 characters target width.

**Linting:**
- ESLint configuration using `eslint.config.mjs`.
- Custom ignores configured for `.next/**`, `out/**`, `build/**`, and `next-env.d.ts`.
- Command to execute: `npm run lint` or `npx eslint`.

## Import Organization

**Order:**
1. React / Next.js core APIs (`react`, `next/navigation`, `next/headers`).
2. Third-party packages (`lucide-react`, `jose`, `@supabase/supabase-js`).
3. Local utilities & configurations via alias `@/` (`@/lib/env`, `@/lib/supabase-admin`).
4. Reusable components (`@/components/pwa/...`).
5. Types and styles.

**Grouping:**
- Individual blank line separating package imports, aliases, and relative imports.
- Sub-sorting within groups: alphabetical by import source name.

**Path Aliases:**
- `@/` maps to the `src/` directory.

## Error Handling

**TypeScript API & Services:**
- Early return for validations and guards (e.g., return `null` or throw errors early).
- Try/catch wraps around network requests, cryptographic actions, and database queries.
- Structured fallback returns (e.g., returning `{ success: false, error: ... }` for API actions, or `null` for failed authentications).
- Log diagnostic information using `console.error` with localized context string.

**Database Layer (PL/pgSQL):**
- Function bodies wrapped in `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END;` blocks to prevent single record errors from failing entire cursor loops.
- Stale loops lock rows using `FOR UPDATE SKIP LOCKED`.
- Log database errors/exceptions using `RAISE WARNING` referencing `SQLERRM`.

## Logging

**TypeScript Core:**
- Browser scope uses `console.log` or `console.warn` for transient network issues.
- Server API scope uses `console.error('[Label] description:', err)` to capture stack traces.
- No third-party logging engines (e.g. Pino, Winston) are configured; the standard `console` API is preferred for Vercel/Next.js function logs.

**SQL Layer:**
- Database execution issues raised via `RAISE WARNING 'Message: %', SQLERRM` for auditability in Supabase function logs.

## Comments

- Focus comments on explaining **why** a specific constraint exists, rather than *what* the code does.
- Document business rules directly above logic checks (e.g. shift boundaries, geofence radius exceptions, token expiry durations).
- Standard inline comments (`// ...`) are preferred; JSDoc (`/** ... */`) is optional but recommended for shared libraries (e.g. cryptographic/auth routines).

## Function & Module Design

- Keep components and helpers single-responsibility. Large functions should be decomposed into smaller helpers within the same module (e.g. `hexToBuf`, `bufToHex` inside `auth.ts`).
- Early guards: Return immediately if prerequisites are not met, reducing indentation levels.
- Named exports are preferred for utilities (`export async function verifyToken`), and default exports are preferred for Next.js components and route pages (`export default function AdminLayoutClient`).

---

*Convention analysis: 2026-05-28*
*Update when coding standards evolve*

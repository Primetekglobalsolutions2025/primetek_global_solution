# UI/UX AUDIT REPORT — Primetek Global Solutions HR Portal

> **Audit Type:** Full Visual & Interaction Audit  
> **Scope:** Admin Portal + Employee Portal (All pages)  
> **Date:** 2026-05-28  
> **Role:** Audit Only — No code changes applied  

---

## Executive Summary

The Primetek HR portal demonstrates a **strong baseline design system** with consistent use of Tailwind utility classes, a cohesive color palette (navy-900, primary-500, zinc scale), and thoughtful use of monospaced labels, status badges, and premium card layouts. The codebase follows a Server Component → Client Component pattern with Suspense boundaries, which is architecturally sound.

However, the audit identifies **47 issues** across 15 audit dimensions, ranging from critical accessibility failures to minor spacing inconsistencies. The most impactful areas are:

1. **Accessibility (Critical):** Missing ARIA labels, keyboard traps in modals, and insufficient color contrast on ultra-small text
2. **Responsive Layout (High):** Mobile bottom-nav overlap with content, missing safe-area-inset handling
3. **Typography (Medium):** Extreme font-size minimums (8px, 9px) below readable thresholds
4. **Interaction (Medium):** Inconsistent loading states, missing skeleton shimmer for some data regions

---

## Audit Checklist Results

| # | Dimension | Severity | Issues Found |
|---|-----------|----------|:------------:|
| 1 | Color & Contrast | 🔴 High | 5 |
| 2 | Typography & Readability | 🟡 Medium | 4 |
| 3 | Spacing & Layout | 🟡 Medium | 4 |
| 4 | Component Consistency | 🟢 Low | 3 |
| 5 | Responsive / Mobile | 🔴 High | 5 |
| 6 | Accessibility (a11y) | 🔴 Critical | 6 |
| 7 | Navigation & Routing | 🟡 Medium | 3 |
| 8 | Loading & Error States | 🟡 Medium | 3 |
| 9 | Forms & Inputs | 🟡 Medium | 3 |
| 10 | Modals & Overlays | 🟡 Medium | 2 |
| 11 | Animations & Motion | 🟢 Low | 2 |
| 12 | Icons & Imagery | 🟢 Low | 1 |
| 13 | Dark Mode / Theme | 🟢 Low | 2 |
| 14 | PWA / Offline | 🟡 Medium | 2 |
| 15 | Data Density & Tables | 🟡 Medium | 2 |

**Total Issues: 47**

---

## 1. Color & Contrast

### 1.1 🔴 Ultra-small text fails WCAG AA contrast
**Files:** All client components  
**Details:** Labels using `text-[8px]`, `text-[9px]`, `text-[10px]` with `text-zinc-400` on white backgrounds yield contrast ratios of ~3.2:1. WCAG AA requires 4.5:1 for text below 18px (or 14px bold).

**Affected patterns:**
- `text-[8px] font-mono font-medium border uppercase tracking-wider` (StatusBadge inner labels)
- `text-[9px] font-mono font-semibold text-zinc-400 uppercase` (KPI labels in dashboard)
- `text-[10px] text-zinc-400` (card subtitles across all pages)

### 1.2 🟡 Inconsistent status color tokens between portals
**Files:** `admin/attendance/AttendanceClient.tsx` L106-141 vs `employee/attendance/AttendanceClient.tsx` L45-80  
**Details:** The admin `StatusBadge` uses `text-amber-605` (non-standard Tailwind shade) and `text-zinc-650`, while the employee version uses standard `text-amber-700` and `text-zinc-650`. The inconsistency creates subtle visual differences across portals.

### 1.3 🟡 Non-standard Tailwind color shades throughout
**Files:** Multiple  
**Details:** Usage of arbitrary shades like `text-zinc-450`, `text-zinc-550`, `text-zinc-650`, `text-primary-650`, `text-violet-650`, `text-emerald-650`, `text-navy-950`, `border-zinc-150`, `border-zinc-250`, `bg-primary-55/50`, `border-primary-105`, `text-primary-750`, `text-primary-850`, `border-emerald-150`, `border-amber-150` that don't exist in standard Tailwind. These require custom `@theme` definitions and some may silently fail.

### 1.4 🟡 Employee login dark theme uses raw `bg-[#020617]`
**File:** `employee/login/page.tsx` L9  
**Details:** Hardcoded hex color instead of using the design system `bg-navy-950` token. Creates a maintenance burden if the palette changes.

### 1.5 🟢 Admin vs Employee loading screens have different branding
**Files:** `AdminLayoutClient.tsx` L198-206 vs `EmployeeLayoutClient.tsx` L131-140  
**Details:** Admin uses `bg-zinc-50`, `w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600`, while Employee uses `bg-white`, `w-10 h-10 rounded-lg bg-navy-900`. This is intentionally different by portal but creates brand inconsistency.

---

## 2. Typography & Readability

### 2.1 🔴 Text below 10px violates readability standards
**Files:** Throughout all admin and employee components  
**Details:** Extensive use of `text-[8px]` for status badges, audit labels, and KPI sub-labels. At 8px, text is illegible on most standard monitors and all mobile devices. Minimum recommended: 11px for labels, 12px for body.

**Examples:**
- `text-[8px] font-bold uppercase tracking-wider` — Admin KPI labels (dashboard L103)
- `text-[8px] font-mono font-medium border` — StatusBadge in attendance (L134)
- `text-[8px] font-mono font-semibold text-zinc-400` — Employee profile details (L134, L195)

### 2.2 🟡 Mixed font-family strategy
**Details:** The app uses `font-sans` (Inter) for body text and `font-mono` for status labels, timestamps, and data values. While intentional for a data-dense admin UI, the `font-heading` (Playfair Display) is only used on some page titles (`text-xl md:text-2xl font-heading font-bold`) but not consistently. Admin dashboard titles use `font-sans` while attendance page uses `font-heading`.

### 2.3 🟡 Heading hierarchy violations
**Files:** Admin dashboard (`dashboard/page.tsx`)  
**Details:** No explicit `<h1>` on the admin dashboard page. The greeting component provides a visually large welcome but uses `<h1>` internally while the section labels (`Workforce Analytics`, `Rapid Controls`, `Live Activity Feed`) use `<h2>`. The page-level heading should be in the page itself.

### 2.4 🟢 Excessive `tracking-wider` / `tracking-widest` on labels
**Files:** All  
**Details:** Nearly every label uses `uppercase tracking-wider` or `tracking-widest`, creating a monotonous visual rhythm where all metadata text looks identical. Reducing tracking variety would improve scannability.

---

## 3. Spacing & Layout

### 3.1 🟡 Inconsistent main content padding between portals
**Files:** `AdminLayoutClient.tsx` L225 vs `EmployeeLayoutClient.tsx` L152  
**Details:** Both use `p-4 md:p-6 pb-24 md:pb-6`, but the admin layout has `bg-zinc-50` on the content area while the employee layout does not specify it (inherits from parent). This creates subtle background color differences.

### 3.2 🟡 `pb-24` bottom padding is a mobile band-aid
**Files:** Both layout clients  
**Details:** `pb-24 md:pb-6` adds 96px of bottom padding on mobile to clear the bottom navigation bar. This is a fragile approach; if the bottom nav height changes, content will be obscured or have excessive whitespace. A CSS variable or `env(safe-area-inset-bottom)` approach would be more robust.

### 3.3 🟡 9-column KPI grid truncation on mid-width screens
**File:** `admin/dashboard/page.tsx` L84  
**Details:** `grid-cols-3 sm:grid-cols-3 lg:grid-cols-9` jumps directly from 3 columns to 9 columns. On tablets (768px-1024px), 3 columns leaves 3 rows of 3 KPI cards, but the 9-card layout at `lg` forces very tight cards. A `md:grid-cols-5` intermediate breakpoint would improve readability.

### 3.4 🟢 Admin and Employee pages use different `space-y` gaps
**Details:** Admin pages vary between `space-y-4`, `space-y-5`, `space-y-6`. Employee dashboard uses `space-y-6 pb-24`. No standard gap token is enforced.

---

## 4. Component Consistency

### 4.1 🟡 Duplicate `StatusBadge` components across files
**Files:** 
- `admin/attendance/AttendanceClient.tsx` L106-141
- `employee/attendance/AttendanceClient.tsx` L45-80
- `employee/dashboard/EmployeeDashboardServerWrapper.tsx` L10-38
- `employee/reports/ReportsClient.tsx` L85-113  

**Details:** Four separate `StatusBadge` implementations with slightly different status-to-color mappings. These should be a single shared component in `components/ui/`.

### 4.2 🟡 Custom notification toast in `AdminSettingsClient` duplicates `Toast` provider
**File:** `admin/settings/AdminSettingsClient.tsx` L593-627  
**Details:** A custom `AnimatePresence` floating toast is implemented inline, while the app has a global `useToast()` hook and `ToastProvider`. This creates a competing notification system that may overlap or conflict.

### 4.3 🟢 Inconsistent Card rounding
**Details:** Some cards use `rounded-lg` (8px), others use `rounded-xl` (12px), and login cards use `rounded-[2.5rem]` (40px). While the login page's pill-shaped card is an intentional design choice, the `rounded-lg` vs `rounded-xl` split within admin pages lacks clear reasoning.

---

## 5. Responsive / Mobile

### 5.1 🔴 Bottom navigation bar can overlap interactive content
**File:** `components/pwa/AppSidebar.tsx`  
**Details:** The mobile bottom nav is `fixed bottom-0` with height ~64px, but content areas only use `pb-24` as a static offset. If content includes fixed-position action buttons (like the floating attendance button in employee attendance), they can collide with the bottom nav.

### 5.2 🔴 Daily Report table horizontal scroll not indicated on mobile
**File:** `employee/daily-report/DailyReportClient.tsx` L192-416  
**Details:** The desktop table has `overflow-x-auto` but no visual indicator (e.g., gradient fade or scroll hint) that the table is scrollable on tablet. Users on iPad-width screens may not realize there are more columns.

### 5.3 🟡 Admin attendance table (1948 lines) has no mobile card view for detail drawer
**File:** `admin/attendance/AttendanceClient.tsx`  
**Details:** The admin attendance view renders complex data in a table format. While a mobile view exists for some elements, the session detail drawer and override forms are not optimized for small screens.

### 5.4 🟡 Mobile Quick Actions are duplicated between dashboard and sidebar
**Files:** Admin dashboard L371-396, Employee dashboard L216-250  
**Details:** Both dashboards render mobile-only quick action blocks (`block md:hidden`), but these largely duplicate the navigation already available in the bottom navigation bar from `AppSidebar`. This creates redundant UI real estate.

### 5.5 🟢 `max-w-7xl` container constraint may leave wide margins on ultrawide screens
**Files:** Both layout clients  
**Details:** The `max-w-7xl mx-auto` caps content at 1280px. On screens wider than 1920px, this leaves significant dead space. For admin dashboards that are data-dense, a `max-w-screen-2xl` might be more appropriate.

---

## 6. Accessibility (a11y)

### 6.1 🔴 No `aria-label` on interactive status toggle buttons
**File:** `admin/employees/EmployeesClient.tsx`  
**Details:** The employee status toggle uses `ToggleLeft`/`ToggleRight` icon buttons without `aria-label`. Screen readers cannot determine the purpose of these controls.

### 6.2 🔴 Modal escape key handling missing
**Files:** `employee/leaves/LeavesClient.tsx` L187-224, `employee/assigned-profiles/AssignedProfilesClient.tsx` L249-365  
**Details:** Modals use `onClick` on the backdrop to close but do not implement `onKeyDown` for Escape key dismissal. This is a WCAG 2.1 SC 2.1.2 failure (No Keyboard Trap).

### 6.3 🔴 Focus trap not implemented in modals
**Files:** All modal implementations  
**Details:** When modals open (leave request, employee creation, profile detail view), keyboard focus is not trapped within the modal. Tab can escape to the background content, creating a confusing experience for keyboard users.

### 6.4 🔴 Notification bell button has no accessible action
**File:** `components/pwa/AppHeader.tsx` L40-47  
**Details:** The notification bell `<button>` has `aria-label="Notifications"` but performs no action on click/keypress. It renders a badge count but is a non-functional interactive element, which violates user expectations.

### 6.5 🟡 Color-only status differentiation
**Files:** All status badges  
**Details:** Status indicators rely solely on color (green = active, red = absent, amber = late). The dot indicator is 1.5px wide, which is insufficient for colorblind users. Adding text labels mitigates this, but the dot alone in some contexts (e.g., KPI pulse dot) carries meaning without alternative text.

### 6.6 🟡 Number input steppers lack accessible labels
**File:** `employee/daily-report/DailyReportClient.tsx`  
**Details:** The `+` and `−` stepper buttons inside the daily report form have no `aria-label`. Screen readers will announce them as unlabeled buttons. Each should have `aria-label="Increase {field name}"` and `aria-label="Decrease {field name}"`.

---

## 7. Navigation & Routing

### 7.1 🟡 Sidebar section labels inconsistent between roles
**File:** `components/pwa/AppSidebar.tsx` L71-93 vs L95-103  
**Details:** Admin sections use title-case names (`Operations`, `Workforce`, `Recruitment & Clients`), while employee sections use ALL-CAPS (`MAIN`, `WORKFORCE`). This creates a jarring difference if a user has access to both portals.

### 7.2 🟡 "More" drawer on mobile has no visual hierarchy
**File:** `components/pwa/AppSidebar.tsx`  
**Details:** The mobile "More" drawer (sheet) renders all overflow nav items in a flat list. There are no section headers, dividers, or groupings to help users quickly find the item they need.

### 7.3 🟢 Pagination uses `<a>` tags with full page reload
**File:** `admin/audit/page.tsx` L367-410  
**Details:** Pagination in the audit logs uses `<a href>` tags which trigger full-page navigation rather than client-side routing via `<Link>` from Next.js. This causes a full SSR round-trip for each page change.

---

## 8. Loading & Error States

### 8.1 🟡 Approvals page has no Suspense fallback
**File:** `admin/approvals/page.tsx` L6-28  
**Details:** The approvals page renders `ApprovalsClient` directly from a server component that calls `Promise.all([...])` with no `<Suspense>` boundary. If data fetching is slow, the entire page blocks. Other admin pages (dashboard, attendance, employees) correctly use `<Suspense fallback={<Skeleton />}>`.

### 8.2 🟡 Error boundary missing on all pages
**Files:** All page-level components  
**Details:** No `error.tsx` files exist in the `admin/*` or `employee/*` route segments. If a server component throws, users see the default Next.js error page instead of a branded error UI.

### 8.3 🟢 Employee attendance polling has no visual indicator
**File:** `employee/attendance/AttendanceClient.tsx`  
**Details:** The heartbeat polling mechanism runs silently. When the tab regains leadership and starts polling, there's no subtle indicator (e.g., a small sync icon pulse) to reassure the user that the system is live.

---

## 9. Forms & Inputs

### 9.1 🟡 No client-side validation on employee creation form
**File:** `admin/employees/EmployeesClient.tsx`  
**Details:** The "Add Employee" modal form has `name`, `email`, `role`, and `department` fields, but no inline validation. The user must submit to discover errors. Adding `required` attributes, email format validation, and inline error messages would improve UX.

### 9.2 🟡 Input focus rings inconsistent
**Details:** Some inputs use `focus:ring-2 focus:ring-primary-400` while others use `focus:ring-2 focus:ring-primary-500/20` or `focus:ring-1 focus:ring-primary-500`. This creates a non-uniform focus visual across forms.

### 9.3 🟢 Search inputs don't debounce
**Files:** `admin/attendance/AttendanceClient.tsx`, `admin/employees/EmployeesClient.tsx`  
**Details:** Client-side search filtering in attendance and employee lists filters on every keystroke. For large lists (50+ employees), this is fine, but adding a 150ms debounce would improve performance perception.

---

## 10. Modals & Overlays

### 10.1 🟡 Modal backdrop z-index competition
**Files:** Leave request modal uses `z-[100]`, profile detail modal uses `z-50`, admin settings toast uses `z-[110]`  
**Details:** Mixed z-index values create potential layering conflicts. If the settings toast and a modal are open simultaneously, the toast may appear above the modal's backdrop.

### 10.2 🟡 Modal content scrolling on very tall forms
**File:** `employee/assigned-profiles/AssignedProfilesClient.tsx` L251  
**Details:** The profile detail modal uses `max-h-[90dvh] overflow-y-auto`, which is correct. However, the leave request modal and employee creation modal don't set max-height, potentially pushing content off-screen on short viewports.

---

## 11. Animations & Motion

### 11.1 🟢 `animate-pulse` used for non-interactive status indicators
**Files:** Dashboard KPI dots, login secure badge, employee connected indicator  
**Details:** Multiple `animate-pulse` instances create a "Christmas tree" effect where 3-5 elements are simultaneously pulsing. This can be distracting and should be reserved for a single primary attention beacon.

### 11.2 🟢 No `prefers-reduced-motion` respect
**Files:** All `framer-motion` animations  
**Details:** None of the `motion.div` elements check `useReducedMotion()`. Users who prefer reduced motion will still see all slide, fade, and scale animations.

---

## 12. Icons & Imagery

### 12.1 🟢 Activity feed uses same icon for all event types
**File:** `admin/dashboard/page.tsx` L203  
**Details:** The `RealtimeActivityFeed` uses the generic `Activity` icon for every event type, even though `eventConfig` defines different semantic colors. Using event-type-specific icons (e.g., `LogIn` for CLOCK_IN, `Coffee` for BREAK_STARTED) would improve scanability.

---

## 13. Dark Mode / Theme

### 13.1 🟢 No dark mode toggle or system preference detection
**Details:** The portal operates in light mode only. The employee login page uses a dark background but the portal itself has no dark mode. Given this is a PWA used potentially in low-light environments, a dark mode option would enhance usability.

### 13.2 🟢 Employee profile header and "Assigned Clients" card use dark backgrounds inconsistently
**Files:** `employee/dashboard/EmployeeDashboardServerWrapper.tsx` L370-386, `employee/profile/ProfileClient.tsx` L187-222  
**Details:** These sections use `bg-navy-900 text-white` as inline dark sections within a light page. While visually premium, they create contrast islands that may feel jarring.

---

## 14. PWA / Offline

### 14.1 🟡 Offline banner is informational-only, no retry action
**File:** `components/pwa/OfflineSyncBanner.tsx`  
**Details:** The offline sync banner notifies users of pending actions but doesn't offer a "Retry Now" or "Sync Now" button. Users must wait for automatic sync or manually navigate to trigger it.

### 14.2 🟡 Service Worker force-activates without user consent
**Files:** `AdminLayoutClient.tsx` L49-66, `EmployeeLayoutClient.tsx` L24-42  
**Details:** Both layouts call `newWorker.postMessage({ type: 'SKIP_WAITING' })` immediately when a new service worker is installed. This can cause unexpected behavior mid-session. Best practice is to show a "New version available, refresh?" banner.

---

## 15. Data Density & Tables

### 15.1 🟡 Admin attendance table has too many data points per row
**File:** `admin/attendance/AttendanceClient.tsx`  
**Details:** Each attendance row displays: employee name, status badge, check-in time, check-out time, duration, productive hours, break seconds, risk level, device type, last heartbeat, and action buttons. On desktop, this requires horizontal scrolling. Consider a progressive disclosure pattern: show essential columns by default, expand for details on click.

### 15.2 🟡 Daily report table columns are too narrow for number inputs
**File:** `employee/daily-report/DailyReportClient.tsx` L192-416  
**Details:** Input fields are `w-12` (48px) with `−` and `+` buttons flanking them. On the desktop table, this creates a cramped interaction area where mis-taps are common. Increasing to `w-14` or `w-16` would improve touch targets.

---

## Priority Remediation Roadmap

### 🔴 Critical (Fix Immediately)
1. Add ARIA labels to all interactive icon buttons and toggle controls
2. Implement keyboard escape handling and focus trapping in all modals
3. Increase minimum font size from 8px → 11px for all visible labels
4. Fix notification bell to either be functional or non-interactive
5. Add `error.tsx` boundaries to admin and employee route segments

### 🟡 High Priority (Fix Within Sprint)
6. Extract `StatusBadge` to a single shared component
7. Replace `pb-24` hack with CSS `env(safe-area-inset-bottom)` calculation
8. Add Suspense boundary to approvals page
9. Add intermediate breakpoints to 9-column KPI grid
10. Implement `prefers-reduced-motion` checks in framer-motion animations
11. Add scroll hints to horizontally-scrollable tables
12. Standardize focus ring styles across all form inputs

### 🟢 Low Priority (Backlog)
13. Normalize custom Tailwind color shades to standard palette
14. Reduce `animate-pulse` usage to 1-2 key indicators per viewport
15. Replace audit page `<a>` pagination with `<Link>` components
16. Add debounce to client-side search filters
17. Add dark mode support
18. Use event-type-specific icons in activity feed

---

## Files Audited

### Admin Portal
| File | Lines | Status |
|------|------:|--------|
| `admin/layout.tsx` | 14 | ✅ Audited |
| `admin/AdminLayoutClient.tsx` | 235 | ✅ Audited |
| `admin/login/page.tsx` | 51 | ✅ Audited |
| `admin/dashboard/page.tsx` | 465 | ✅ Audited |
| `admin/attendance/page.tsx` | 29 | ✅ Audited |
| `admin/attendance/AttendanceClient.tsx` | 1948 | ✅ Audited (first 200 lines + structure) |
| `admin/approvals/page.tsx` | 29 | ✅ Audited |
| `admin/approvals/ApprovalsClient.tsx` | 866 | ✅ Audited (first 200 lines + structure) |
| `admin/employees/page.tsx` | 20 | ✅ Audited |
| `admin/employees/EmployeesClient.tsx` | 818 | ✅ Audited (first 200 lines + structure) |
| `admin/settings/page.tsx` | 8 | ✅ Audited |
| `admin/settings/AdminSettingsClient.tsx` | 631 | ✅ Audited |
| `admin/profile/page.tsx` | 62 | ✅ Audited |
| `admin/audit/page.tsx` | 416 | ✅ Audited |

### Employee Portal
| File | Lines | Status |
|------|------:|--------|
| `employee/layout.tsx` | 12 | ✅ Audited |
| `employee/EmployeeLayoutClient.tsx` | 162 | ✅ Audited |
| `employee/login/page.tsx` | 52 | ✅ Audited |
| `employee/dashboard/EmployeeDashboardServerWrapper.tsx` | 408 | ✅ Audited |
| `employee/attendance/AttendanceClient.tsx` | 2155 | ✅ Audited (first 300 lines + structure) |
| `employee/leaves/LeavesClient.tsx` | 228 | ✅ Audited |
| `employee/daily-report/DailyReportClient.tsx` | 634 | ✅ Audited |
| `employee/profile/ProfileClient.tsx` | 244 | ✅ Audited |
| `employee/assigned-profiles/AssignedProfilesClient.tsx` | 385 | ✅ Audited |
| `employee/reports/ReportsClient.tsx` | 753 | ✅ Audited |

### Shared Components
| File | Lines | Status |
|------|------:|--------|
| `components/pwa/AppSidebar.tsx` | 444 | ✅ Audited (first 100 lines + structure) |
| `components/pwa/AppHeader.tsx` | 55 | ✅ Audited |
| `components/ui/Button.tsx` | — | ✅ Audited (prior session) |
| `components/ui/Card.tsx` | — | ✅ Audited (prior session) |
| `components/ui/Toast.tsx` | — | ✅ Audited (prior session) |
| `components/ui/ConfirmationModal.tsx` | — | ✅ Audited (prior session) |
| `globals.css` | — | ✅ Audited (prior session) |

---

*End of Audit Report*


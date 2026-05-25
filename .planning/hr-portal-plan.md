# HR Portal — Implementation Plan

> **Status:** Planned (Not Started)
> **Priority:** Medium
> **Depends on:** Employee Portal, Auth System, Admin Portal

---

## Overview

Currently HR users (`role = 'hr'` in the `employees` table) log into the employee
portal and see the exact same UI as a regular employee. They have no tools to manage
people. This plan adds a full HR-specific experience within the existing employee
portal layout — no new login, no new route prefix — just a role-gated sidebar and
dedicated HR pages under `/employee/hr/`.

---

## Goals

1. Give HR a distinct navigation set from regular employees
2. Allow HR to approve/reject leave requests
3. Allow HR to view and manage all employee attendance records
4. Allow HR to view the employee directory and basic profile info
5. Allow HR to manually create or correct attendance entries
6. Provide an HR analytics dashboard (headcount, leave stats, late/absent trends)

---

## Phase 1 — HR Navigation & Routing

### Files to change
| File | Change |
|---|---|
| `src/components/pwa/AppSidebar.tsx` | Add `desktopHRItems` + `mobileHRBottom` + `mobileHRMore` arrays; use `role === 'hr'` branch |
| `src/middleware.ts` | Allow HR to access `/employee/hr/*` routes |

### HR Sidebar Items (Desktop)
```
📊  Dashboard         /employee/hr/dashboard
👥  Employees         /employee/hr/employees
✅  Leave Approvals   /employee/hr/leaves
🕐  Attendance        /employee/hr/attendance
👤  My Profile        /employee/profile
```

### HR Bottom Bar (Mobile)
```
📊 Dashboard | 👥 Employees | ✅ Leaves | 🕐 Attendance | ⋯ More
```

---

## Phase 2 — HR Dashboard (`/employee/hr/dashboard`)

### UI Cards
- **Headcount** — total active employees
- **On Leave Today** — count of approved leaves for today
- **Late This Month** — count of late check-ins this month
- **Pending Approvals** — count of pending leave requests (with link)

### Recent Activity Feed
- Last 10 check-ins (any employee)
- Last 5 leave requests submitted

### Data Sources
- `employees` table — count, status
- `attendance` table — today's records
- `leave_requests` table — pending count

---

## Phase 3 — Leave Approvals (`/employee/hr/leaves`)

### Features
- List all leave requests (all employees) with filters: status, type, date range
- Approve / Reject buttons per row
- Bulk approve support
- Leave balance deduction on approval (update `leave_balances.used_days`)
- Reason input when rejecting
- Email/notification stub (future)

### Server Actions (new file: `src/app/employee/hr/leaves/actions.ts`)
```ts
getAllLeaveRequests()
approveLeave(id: string)
rejectLeave(id: string, reason: string)
```

### DB changes
- None required — uses existing `leave_requests` + `leave_balances` tables
- RLS: Add policy so HR employees can SELECT/UPDATE `leave_requests` for all employees

---

## Phase 4 — Attendance Management (`/employee/hr/attendance`)

### Features
- View attendance table for all employees (filterable by employee, date, status)
- Manual check-in / check-out entry for an employee (HR override)
- Edit status (Present → Late, etc.)
- Export CSV (simple download)

### Server Actions (new file: `src/app/employee/hr/attendance/actions.ts`)
```ts
getAllAttendance(filters: { employeeId?, date?, status? })
createAttendanceRecord(employeeId, date, checkIn, checkOut, status)
updateAttendanceRecord(id, patch)
```

### DB changes
- RLS: HR role should be able to SELECT/INSERT/UPDATE `attendance` for all employees
- New column `modified_by` (UUID, nullable) to track HR overrides

---

## Phase 5 — Employee Directory (`/employee/hr/employees`)

### Features
- Table of all employees with: Name, ID, Department, Role, Status, Join Date
- Click row → view profile detail (read-only)
- Search / filter by department, status
- Quick action: Reset Password (triggers password reset flow)
- Quick action: Activate / Deactivate employee

### Server Actions (new file: `src/app/employee/hr/employees/actions.ts`)
```ts
getAllEmployees()
toggleEmployeeStatus(id, status: 'Active' | 'Inactive')
```

### DB changes
- None — uses existing `employees` table
- RLS: HR can SELECT all employees, UPDATE `status` only

---

## Phase 6 — RLS Policy Updates (Supabase Migration)

New migration file: `supabase_migrations/10_hr_rls_policies.sql`

```sql
-- HR can view all leave requests
CREATE POLICY "HR can view all leave_requests"
  ON public.leave_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid() AND role = 'hr'
    )
  );

-- HR can update leave requests (approve/reject)
CREATE POLICY "HR can update leave_requests"
  ON public.leave_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid() AND role = 'hr'
    )
  );

-- HR can view all attendance
CREATE POLICY "HR can view all attendance"
  ON public.attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid() AND role = 'hr'
    )
  );

-- HR can insert/update attendance (manual overrides)
CREATE POLICY "HR can manage attendance"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid() AND role = 'hr'
    )
  );

-- HR can view all employees
CREATE POLICY "HR can view all employees"
  ON public.employees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e2
      WHERE e2.id = auth.uid() AND e2.role = 'hr'
    )
  );

-- HR can update employee status
CREATE POLICY "HR can update employee status"
  ON public.employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e2
      WHERE e2.id = auth.uid() AND e2.role = 'hr'
    )
  )
  WITH CHECK (true);
```

---

## File Structure (New Files)

```
src/app/employee/hr/
├── layout.tsx                    ← HR route guard (redirect if role !== 'hr')
├── dashboard/
│   └── page.tsx
├── leaves/
│   ├── page.tsx
│   └── actions.ts
├── attendance/
│   ├── page.tsx
│   ├── AttendanceHRClient.tsx
│   └── actions.ts
└── employees/
    ├── page.tsx
    ├── EmployeeDirectoryClient.tsx
    └── actions.ts
```

---

## API / Auth Changes

The existing `/api/auth/employee-login` and `/api/auth/me` routes already return the
`role` field correctly. No auth changes needed.

Middleware update: extend the employee-protected route matcher to also allow
`/employee/hr/*` for HR users only — redirect regular employees to `/employee/dashboard`
if they try to access HR routes.

---

## UI Design Notes

- HR pages share the same design system as the employee portal (navy-900 dark cards,
  primary-500 accents, white surface cards)
- Use a subtle purple/violet accent for HR-specific elements to distinguish the role
  visually (e.g., approval badges, HR header pill)
- Leave approval buttons: `Approve` (emerald), `Reject` (red) — with confirmation modal
- Attendance overrides should show a `HR Override` badge on the record

---

## Testing Checklist

- [ ] HR user can log in and sees HR sidebar, not employee sidebar
- [ ] Regular employee cannot access `/employee/hr/*` routes (redirected)
- [ ] Admin cannot access `/employee/hr/*` routes (redirected to admin portal)
- [ ] HR can approve a leave → `leave_requests.status` updates to `Approved`
- [ ] HR can approve a leave → `leave_balances.used_days` increments correctly
- [ ] HR can reject a leave → status updates to `Rejected`
- [ ] HR manual attendance entry appears in employee's attendance history
- [ ] HR attendance override shows `HR Override` badge
- [ ] HR can deactivate an employee → employee cannot log in (`status = Inactive`)
- [ ] HR dashboard headcount reflects actual active employee count

---

## Estimated Effort

| Phase | Effort |
|---|---|
| 1 — Navigation & Routing | ~1h |
| 2 — HR Dashboard | ~2h |
| 3 — Leave Approvals | ~3h |
| 4 — Attendance Management | ~4h |
| 5 — Employee Directory | ~2h |
| 6 — RLS Migrations | ~1h |
| **Total** | **~13h** |

# Server Actions Called from Client Components

This document catalogues all Next.js Server Actions (`'use server'`) invoked directly from Client Components (`'use client'`) across the HR Portal application.

---

## 🧑‍💼 Employee Portal

### 1. Attendance Management
*   **Client Component**: [AttendanceClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/AttendanceClient.tsx)
*   **Actions Source**: [actions.ts (employee/attendance)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/attendance/actions.ts)
*   **Invoked Actions**:
    *   `checkIn(lat, lng, fingerprint)`: Starts an attendance session using event sourcing.
    *   `checkOut(recordId, lat, lng, fingerprint)`: Standard clock-out that appends a `CLOCK_OUT` event.
    *   `startBreak(recordId)`: Places employee on scheduled break status.
    *   `endBreak(recordId)`: Standard resumption of work from break.
    *   `resumeSession(recordId, isRemote)`: Recovers session after temporary offline/reload disruptions.
    *   `logStatusTransitionEvent(sessionId, newStatus)`: Dispatches telemetry events (Idle, Working, Break (Auto)).
    *   `getLateLoginsStats()`: Retrieves cumulative monthly late login statistics and warning/deduction metrics.
    *   `getEmployeeDisputes(employeeId)`: Fetches past and active dispute requests filed by the employee.
    *   `submitDispute(attendanceId, category, reason)`: Initiates a new dispute request for late check-in or missing clock-out corrections.

### 2. Leave Management
*   **Client Component**: [LeavesClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/leaves/LeavesClient.tsx)
*   **Actions Source**: [actions.ts (employee/leaves)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/leaves/actions.ts)
*   **Invoked Actions**:
    *   `getLeaveBalances(employeeId)`: Queries annual and monthly leave allowances (Casual, Sick, Earned, Unpaid).
    *   `createLeaveRequest(data)`: Files a new leave application.
    *   `cancelLeaveRequest(id)`: Retracts a pending or approved leave request.

### 3. Daily Activity Reporting
*   **Client Component**: [DailyReportClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/daily-report/DailyReportClient.tsx)
*   **Actions Source**: [actions.ts (employee/daily-report)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/daily-report/actions.ts)
*   **Invoked Actions**:
    *   `submitDailyReport(data)`: Submits the shift summary report.
    *   `getDailyReports(employeeId)`: Fetches historically submitted daily work logs.

### 4. Employee Self-Service Profile
*   **Client Component**: [ProfileClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/profile/ProfileClient.tsx)
*   **Actions Source**: [actions.ts (employee/profile)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/employee/profile/actions.ts)
*   **Invoked Actions**:
    *   `updateProfile(data)`: Updates contact numbers, designation, and metadata.
    *   `changePassword(currentPass, newPass)`: Changes Employee App password with bcrypt confirmation.
    *   `enableMFA()`: Initializes TOTP Multi-Factor Authentication secret key.
    *   `verifyAndEnableMFA(code)`: Validates code and completes MFA lock down.
    *   `disableMFA(code)`: Disables active MFA requirements.

---

## 👑 Admin Portal

### 1. Attendance Monitor
*   **Client Component**: [AttendanceClient.tsx (admin)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/attendance/AttendanceClient.tsx)
*   **Actions Source**: [actions.ts (admin/attendance)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/attendance/actions.ts)
*   **Invoked Actions**:
    *   `getAdminAttendance(filters)`: Retrieves paginated and filtered historical attendance sheets.
    *   `overrideDeviceValidation(recordId, field, value)`: Creates event-sourced overrides on specific attendance attributes.
    *   `toggleExemption(recordId, fieldName, value)`: Manages late penalties or permission flags.
    *   `exportAttendanceExcel(year)`: Assembles, saves, and creates signed links to download annual attendance reports.

### 2. Approvals & Disputes Queue
*   **Client Component**: [ApprovalsClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/approvals/ApprovalsClient.tsx)
*   **Actions Source**: [actions.ts (admin/approvals)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/approvals/actions.ts)
*   **Invoked Actions**:
    *   `updateLeaveStatus(id, status)`: Approves/rejects leave requests. Deducts balances atomically.
    *   `updateWFHStatus(id, status)`: Approves/rejects pending WFH requests.
    *   `resolveDispute(disputeId, status, justification)`: Processes attendance metric disputes.
    *   `getPendingDisputes()`: Queries outstanding disputes with join telemetry (productive_hours, break_seconds).
    *   `getDisputeTimeline(attendanceId)`: Generates structured event logs for specific dispute session telemetry.
    *   `getPendingCountOnly()`: Counts pending leaves, WFH requests, and disputes in a lightweight fetch.

### 3. Employee Roster & Wallet Balances
*   **Client Component**: [EmployeesClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/employees/EmployeesClient.tsx)
*   **Actions Source**: [actions.ts (admin/employees)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/employees/actions.ts)
*   **Invoked Actions**:
    *   `getAdminEmployees()`: Fetches roster records.
    *   `toggleEmployeeStatus(id, currentStatus)`: Locks/unlocks employee profiles.
    *   `createEmployee(data)`: Configures new staff credentials with secure random passwords.
    *   `deleteEmployee(id)`: Deletes employee database profile with cascading cleanup.
    *   `resetEmployeeMFA(id)`: Force-disables MFA requirements on user credentials.
    *   `getEmployeeBalances(employeeId)`: Fetches remaining leave allowances.
    *   `updateEmployeeBalances(employeeId, balances)`: Directly adjusts active balance wallets.

### 4. Admin Settings Hub
*   **Client Component**: [AdminSettingsClient.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/settings/AdminSettingsClient.tsx)
*   **Actions Source**: [actions.ts (admin/settings)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/settings/actions.ts)
*   **Invoked Actions**:
    *   `getSystemStatus()`: Fetches service health node metrics.
    *   `getNotificationPreferences()`: Queries active system communication config flags.
    *   `updateNotificationPreferences(prefs)`: Overwrites active alert settings.
    *   `updateOfficeLocation(id, data)`: Overwrites geofence boundaries (lat, lng, radius) for attendance verification.

### 5. Admin Profile Manager
*   **Client Component**: [AdminProfileForm.tsx](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/components/profile/AdminProfileForm.tsx)
*   **Actions Source**: [actions.ts (admin/profile)](file:///c:/Users/janak/Downloads/_Projects/primetek_global_solution-main/primetek_global_solution-main/src/app/admin/profile/actions.ts)
*   **Invoked Actions**:
    *   `updateAdminProfile(fullName)`: Updates Auth metadata and re-authenticates the session cookie.
    *   `changePassword(currentPass, newPass)`: Changes administrator password.

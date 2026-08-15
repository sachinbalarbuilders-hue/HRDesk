# HRDesk — AI Agent Notes

This file contains critical architectural notes that every AI agent MUST read before
making any changes to attendance calculation, payroll, or leave logic.

---

## ⚠️ ATTENDANCE COUNTING: SINGLE SOURCE OF TRUTH

### The Rule
**NEVER write attendance counting logic directly in a Page, Service, or Controller.**
**ALWAYS use `AttendanceSummaryService`.**

### Why
The system previously had two separate counting engines:
- `MonthlyAttendanceSheet.cshtml.cs` — had its own counting logic
- `PayrollService.cs` — had its own separate counting logic

This caused permanent discrepancies between what the Monthly Sheet showed and what
Payroll deducted. Employees were incorrectly penalised (e.g., LOP deducted on days
that had approved Comp Off leave).

### The Fix (April 2026)
All attendance counting logic was extracted into a **single shared service**:

```
HRDesk.Web/Services/AttendanceSummaryService.cs
```

Both `MonthlyAttendanceSheet` and `PayrollService` now call this shared service.
Discrepancies are now **architecturally impossible**.

---

## Key Files — Attendance & Payroll

| File | Role |
|------|------|
| `Services/AttendanceSummaryService.cs` | ⭐ **SHARED COUNTING LOGIC** — touch this first |
| `Services/PayrollService.cs` | Salary calculation — delegates counting to shared service |
| `Pages/Attendance/MonthlyAttendanceSheet.cshtml.cs` | UI display — delegates counting to shared service |
| `Services/AttendanceProcessorService.cs` | Processes raw biometric punches into daily_attendance records |

---

## Before Making Any Change To Attendance / Payroll Logic

1. **First read** `Services/AttendanceSummaryService.cs` fully
2. **Make your change in `AttendanceSummaryService.cs`** — not in the Page or PayrollService
3. The change will automatically apply to both Monthly Sheet and Payroll
4. Run `dotnet build` to verify 0 errors

### When to update AttendanceSummaryService
- Adding a new leave type or status code
- Changing how half-days are counted (COHF, PHF, SHF, HF, etc.)
- Changing Comp Off (CO) credit logic
- Changing LOP (Loss of Pay) calculation rules
- Any change that should affect both the attendance sheet AND payroll

### When NOT to touch AttendanceSummaryService
- Pure UI/display changes (colors, tooltips, column widths, etc.) — those stay in the .cshtml pages
- Salary formula changes (gross, deductions, components) — those stay in PayrollService

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `daily_attendance` | One row per employee per day. Key field: `status` |
| `leave_applications` | Approved/Adjusted leave requests. Always check this for context |
| `leave_types` | Leave type master. `Code` field (e.g., "CO", "PL", "SL") and `IsPaid` flag |

### Important Status Codes in `daily_attendance.status`

| Status | Meaning |
|--------|---------|
| `Present` | Full day present |
| `COHF` | Comp Off Half Day (standardised code — **use this, not `CHF`**) |
| `PHF` | Paid Leave Half Day |
| `SHF` | Sick Leave Half Day |
| `HF` | Unauthorized Half Day (no leave application) |
| `Half Day` | Legacy status — may have an approved leave application — always check `leave_applications` |
| `Weekoff` / `W/O` | Week off |
| `CO` | Full day Comp Off |
| `Absent` | Absent with LOP |
| `Holiday` | Public holiday |

> **Note:** `CHF` was the old Comp Off half-day code. It was migrated to `COHF` in April 2026.
> All DB records now use `COHF`. Do not reintroduce `CHF`.

---

## Comp Off Logic (CO / COHF)

- Comp Off is treated as a **Weekoff credit** — it does NOT deduct from payable days
- A `COHF` day where employee punched in (`InTime != null`) = **0.5 Present + 0.5 W/O**
- A `COHF` day where employee did NOT punch in = **0.5 W/O only** (other half is UL)
- A full-day `CO` = **1.0 W/O**
- Always check both the `status` field AND `leave_applications` — the status alone may be generic (e.g., `"Half Day"`) while the leave application reveals it's a CO

---

## AttendanceSummaryService API

```csharp
// For single-employee operations (e.g., PayrollService):
var summary = await _attendanceSummaryService.GetSummaryAsync(employeeId, year, month);

// For bulk page operations (e.g., MonthlyAttendanceSheet — avoids N extra DB queries):
var summary = _attendanceSummaryService.ComputeSummary(employeeId, year, month, preLoadedLogs, preLoadedLeaveApps);
```

### AttendanceSummaryResult fields
- `PresentCount` — payable present days
- `AbsentCount` — pure absences
- `HalfDayCount` — number of half-day events
- `WeekoffCount` — weekoffs + CO credits
- `HolidayCount` — public holidays
- `LeaveCount` — paid leaves
- `UnpaidLeaveCount` — unpaid / LWP
- `PayableDays` — `PresentCount + WeekoffCount + HolidayCount + LeaveCount`
- `LopBreakdown` — `Dictionary<DateOnly, decimal>` of LOP per date

---

## 🛡️ APPROVED TECHNOLOGY STACK & ARCHITECTURAL GUARDRAILS

### Core Approved Stack
| Layer | Technology | Rules & Guardrails |
| :--- | :--- | :--- |
| **Backend** | **ASP.NET Core (.NET 8 / C#)** | Primary backend engine. All business logic, biometrics, and calculations must remain in C#. |
| **Database** | **Microsoft SQL Server (MSSQL)** | **STRICT RULE**: The database is stabilized on SQL Server with EF Core (`Microsoft.EntityFrameworkCore.SqlServer`). **DO NOT** migrate or suggest switching to MySQL, MongoDB, SQLite, or Postgres unless explicitly instructed by the user. |
| **ORM** | **Entity Framework Core 8** | Use EF Core migrations and LINQ queries. Do not add redundant ORMs. |
| **RBAC & Security** | **`IPermissionService`** | All row-level data scoping (`All`, `Reporting`, `Department`, `Own`) MUST use `_permissionService.ApplyEmployeeScopeAsync`, `ApplyLeaveScopeAsync`, etc. |
| **Attendance Engine** | **`AttendanceSummaryService`** | **Single Source of Truth** for all attendance, payable days, LOP, and leave credit counts. |
| **Frontend Strategy** | **React (Vite + TS + Tailwind + shadcn/ui)** or **Razor Pages** | When building REST APIs for frontend/mobile, use ASP.NET Core API controllers calling existing services. |
| **Mobile Strategy** | **React Native / Capacitor** | Connects to the same .NET REST API endpoints (`/api/...`). |

### 🚫 STRICT FORBIDDEN ACTIONS FOR AI AGENTS
1. **DO NOT change the database engine** (No MySQL, No MongoDB, No SQLite). The database is **Microsoft SQL Server**.
2. **DO NOT write separate attendance/LOP counting logic** in any Controller, Page, or Service. Always delegate to `AttendanceSummaryService`.
3. **DO NOT bypass RBAC scoping**. Always apply `IPermissionService` filters to queries when fetching employees, attendance logs, rosters, or leaves.
4. **DO NOT install bloated or vulnerable NuGet/npm packages**. Keep dependencies lean.
5. **DO NOT reintroduce obsolete status codes** (e.g., `CHF` was migrated to `COHF`).
6. **DO NOT break mobile/tablet responsiveness**. Always ensure horizontal tables have sticky columns, drawers collapse to full width on mobile, and the viewport root has zero horizontal overflow.
7. **DO NOT deviate from `HRMS-DESIGN.md`**. Always use the defined Register design system tokens, `Fraunces` / `IBM Plex` typography, and ledger styling.

---

## 🔒 Security First

- **NEVER use vulnerable libraries.**
- **Security is the first priority.** Always check for known vulnerabilities in NuGet or npm packages before installing or updating them.
- If a vulnerability is found in a package, immediately find a safe, patched version (e.g., using dotnet list package --vulnerable).
- When updating packages to patch security issues, always verify licensing changes (e.g. Split Licenses) to ensure the project remains legally compliant.

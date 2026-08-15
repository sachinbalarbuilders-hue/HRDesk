# HRDesk — Architecture & Tech Stack Rules for AI Agents

Every AI Agent working on this codebase MUST adhere strictly to the following rules:

---

## 1. Approved Technology Stack

| Layer | Approved Technology |
| :--- | :--- |
| **Backend** | ASP.NET Core (.NET 8.0 / C#) |
| **Database** | Microsoft SQL Server (MSSQL) with EF Core 8 |
| **Authentication & RBAC** | ASP.NET Core Identity / Cookie / JWT + `IPermissionService` |
| **Attendance & Payroll Calculation** | `AttendanceSummaryService` (Strict Single Source of Truth) |
| **Frontend Strategy** | React (Vite + TypeScript + Tailwind CSS + shadcn/ui) OR ASP.NET Core Razor Pages |
| **Mobile App Strategy** | React Native (Expo) OR Capacitor connecting to ASP.NET Core REST API (`/api/...`) |

---

## 2. Hard Architectural Rules

1. **Database Stability**:
   - The database engine is **Microsoft SQL Server (MSSQL)**.
   - **NEVER** switch or migrate to MySQL, MongoDB, SQLite, or PostgreSQL.
2. **Attendance & Payroll Counting**:
   - **NEVER** write attendance counting or LOP deduction logic directly inside Razor Pages, Controllers, or ViewModels.
   - **ALWAYS** call `_attendanceSummaryService.ComputeSummary()` or `_attendanceSummaryService.GetSummaryAsync()`.
3. **Row-Level Security & Scoping**:
   - Always apply `_permissionService.ApplyEmployeeScopeAsync()`, `ApplyLeaveScopeAsync()`, `ApplyAttendanceScopeAsync()`, etc., when querying data.
   - Respect assigned scopes: `All`, `Reporting`, `Department`, `Own`.
4. **No Bloated or Unnecessary Libraries**:
   - Do not install random npm or NuGet packages without explicit purpose and checking for vulnerabilities (`dotnet list package --vulnerable`).
5. **No Redundant Backend Re-writes**:
   - When building mobile or React frontend features, expose REST API endpoints (`/api/...`) in the existing .NET 8 project that delegate directly to existing domain services (`AttendanceSummaryService`, `PayrollService`, etc.).

---

## 3. Frontend Architecture & Responsiveness Rules

1. **Design System Adherence (`HRMS-DESIGN.md`)**:
   - Always follow **The Register** design specification. Use the defined token variables (`--navy-900`, `--paper`, `--surface`, `--rule`, `--gold-500`, `--ok-600`, `--warn-600`, `--err-600`).
   - Use `Fraunces` for Display titles, `IBM Plex Sans` for UI/body, and `IBM Plex Mono` for all tabular records, timestamps, and numbers.
2. **Strict Mobile & Tablet Responsiveness**:
   - **Sidebar**: Full 240px sidebar on Desktop; compact icon mode (68px); auto-collapses to slide-out drawer on tablet/mobile (<1024px) with backdrop overlay.
   - **Horizontal Scroll Containment**: Dense tables (31-day matrix, punch ledger) MUST live in `overflow-x-auto` wrappers with `sticky left-0` on the employee column so context is never lost.
   - **Zero Viewport Breakage**: The root viewport must never develop horizontal body scrollbars (`overflow-hidden` container).
   - **Slide-in Drawers & Modals**: Detail panels (e.g. 480px employee profile, leave application) must scale to full-width (`w-full`) on mobile (<640px).
   - **Touch Targets**: Interactive controls must maintain minimum 36px–44px clickable areas on touch screens.


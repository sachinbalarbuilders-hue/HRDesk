namespace HRDesk.Web.Constants;

public static class AppPermissions
{
    // Permission Scopes
    public static class Scopes
    {
        // General Data Scopes (Branch-Contained)
        public const string All = "All";                 // Organization wide (System Admin)
        public const string OwnBranch = "Own Branch";     // Entire branch (Branch Level)
        public const string Department = "Department";   // Entire department + own
        public const string Reporting = "Reporting To";  // Reporting team (direct reportees) + own
        public const string Own = "Own";                 // Logged-in user's own profile/records only

        // Edit Scopes
        public const string EditBasicInfo = "Basic Information";
        public const string EditStatusChanges = "Status Changes";
        public const string EditCompensation = "Compensation";
        public const string EditAllDetails = "All Details";

        // Delete Scopes
        public const string DeleteSoft = "Soft Delete";
        public const string DeletePermanent = "Permanent Delete";
        public const string DeleteBulk = "Bulk Delete";
    }

    // Modules
    public static class Modules
    {
        public const string Employees = "Employees";
        public const string Attendance = "Attendance";
        public const string Leaves = "Leaves & Comp-Off";
        public const string Payroll = "Payroll & Loans";
        public const string Masters = "Masters & Structure";
        public const string Shifts = "Shifts & Schedule";
        public const string Recruitment = "Recruitment";
        public const string System = "System & Settings";
        public const string SelfService = "Employee Self-Service (ESS)";
    }

    // Permission Keys
    public static class Keys
    {
        // 1. Employees Module
        public const string EmployeesView = "Employees.View";
        public const string EmployeesCreate = "Employees.Create";
        public const string EmployeesEdit = "Employees.Edit";
        public const string EmployeesDelete = "Employees.Delete";
        public const string EmployeesViewSalary = "Employees.ViewSalary";

        // 2. Attendance Module
        public const string AttendanceView = "Attendance.View";
        public const string AttendanceProcess = "Attendance.Process";
        public const string AttendanceRoster = "Attendance.Roster";
        public const string AttendanceMonthlySheet = "Attendance.MonthlySheet";
        public const string AttendanceRegularize = "Attendance.Regularize";

        // 3. Leaves & Comp-Off Module
        public const string LeavesView = "Leaves.View";
        public const string LeavesApply = "Leaves.Apply";
        public const string LeavesApprove = "Leaves.Approve";
        public const string LeavesManageTypes = "Leaves.ManageTypes";
        public const string LeavesManageAllocations = "Leaves.ManageAllocations";
        public const string CompOffApprove = "CompOff.Approve";

        // 4. Payroll & Loans Module
        public const string PayrollView = "Payroll.View";
        public const string PayrollProcess = "Payroll.Process";
        public const string PayrollManageSalary = "Payroll.ManageSalary";
        public const string PayrollManageLoans = "Payroll.ManageLoans";

        // 5. Masters & Structure Module
        public const string MastersDepartments = "Masters.Departments";
        public const string MastersDesignations = "Masters.Designations";
        public const string MastersOrganizations = "Masters.Organizations";

        // 6. Shifts & Schedule Module
        public const string ShiftsManage = "Shifts.Manage";
        public const string HolidaysManage = "Holidays.Manage";

        // 7. Recruitment Module
        public const string RecruitmentCandidates = "Recruitment.Candidates";
        public const string RecruitmentInterviews = "Recruitment.Interviews";

        // 8. System & Settings Module
        public const string SystemDevices = "System.Devices";
        public const string SystemRoles = "System.Roles";
        public const string SystemSettings = "System.Settings";
        public const string SystemLogs = "System.Logs";

        // 9. Employee Self-Service (ESS)
        public const string ESSDashboard = "ESS.Dashboard";
        public const string ESSMyAttendance = "ESS.MyAttendance";
        public const string ESSApplyLeave = "ESS.ApplyLeave";
        public const string ESSMyPayslips = "ESS.MyPayslips";
        public const string ESSMyRoster = "ESS.MyRoster";
    }

    public record PermissionDefinition(
        string Key, 
        string DisplayName, 
        string Module, 
        string Description, 
        bool SupportsScope = false,
        string[]? ScopeOptions = null,
        string DefaultScope = "Own Branch",
        string[]? SubSections = null);

    public static readonly List<PermissionDefinition> All = new()
    {
        // Employees
        new(Keys.EmployeesView, "View Scope", Modules.Employees, "View employee profiles and directories", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch",
            SubSections: new[] { "Work", "Documents", "Attendance", "Action", "Personal", "Credentials", "Other", "Activity" }),

        new(Keys.EmployeesCreate, "Create Scope", Modules.Employees, "Add new employees to the organization", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Own Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.EmployeesEdit, "Edit Scope", Modules.Employees, "Update employee personal and job details", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Basic Information", "Status Changes", "Compensation", "All Details" },
            DefaultScope: "All Details"),

        new(Keys.EmployeesDelete, "Delete Scope", Modules.Employees, "Archive or remove employee records", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.EmployeesViewSalary, "View Salary Info", Modules.Employees, "View compensation, CTC, and bank info", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // Attendance
        new(Keys.AttendanceView, "View Scope", Modules.Attendance, "View biometric logs and daily attendance", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceProcess, "Process Attendance", Modules.Attendance, "Run attendance calculation engine",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceRoster, "Roster Scope", Modules.Attendance, "Assign and manage shift rosters", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceMonthlySheet, "Monthly Sheet Scope", Modules.Attendance, "Access aggregated monthly attendance sheet", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceRegularize, "Regularization Scope", Modules.Attendance, "Approve or reject attendance regularizations", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // Leaves & Comp-Off
        new(Keys.LeavesView, "View Scope", Modules.Leaves, "View submitted leave applications", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesApply, "Apply Scope", Modules.Leaves, "Submit leave on behalf of staff", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesApprove, "Approve Scope", Modules.Leaves, "Approve or reject leave requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesManageTypes, "Manage Leave Types", Modules.Leaves, "Configure leave quotas and rules"),
        new(Keys.LeavesManageAllocations, "Manage Allocations", Modules.Leaves, "Credit and adjust leave balances"),

        new(Keys.CompOffApprove, "Comp-Off Approval Scope", Modules.Leaves, "Approve weekend / overtime comp-off credits", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // Payroll & Loans
        new(Keys.PayrollView, "View Scope", Modules.Payroll, "View salary statements and payroll reports", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.PayrollProcess, "Process Payroll", Modules.Payroll, "Calculate monthly payroll and generate slips",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.PayrollManageSalary, "Manage Salary Structure", Modules.Payroll, "Configure salary components and formulas",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.PayrollManageLoans, "Loans Manage Scope", Modules.Payroll, "Approve and track employee loans", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // Masters
        new(Keys.MastersDepartments, "Manage Departments", Modules.Masters, "Create, edit, and delete departments"),
        new(Keys.MastersDesignations, "Manage Designations", Modules.Masters, "Create, edit, and delete designations"),
        new(Keys.MastersOrganizations, "Manage Organizations", Modules.Masters, "Manage company branches and organizations"),

        // Shifts & Schedule
        new(Keys.ShiftsManage, "Manage Shifts", Modules.Shifts, "Create and edit shift timings and grace periods"),
        new(Keys.HolidaysManage, "Manage Holidays", Modules.Shifts, "Configure annual holiday calendars"),

        // Recruitment
        new(Keys.RecruitmentCandidates, "Manage Candidates", Modules.Recruitment, "Candidate pipeline and resumes",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RecruitmentInterviews, "Schedule Interviews", Modules.Recruitment, "Interview scheduling and evaluations",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // System
        new(Keys.SystemDevices, "Manage Biometric Devices", Modules.System, "Configure LAN/Cloud biometric sync & machines"),
        new(Keys.SystemRoles, "Manage Roles & Permissions", Modules.System, "Create, edit, and delete custom roles"),
        new(Keys.SystemSettings, "Manage System Settings", Modules.System, "Configure general company settings"),
        new(Keys.SystemLogs, "View Service Logs", Modules.System, "Inspect audit trails and background job logs"),

        // Employee Self-Service (ESS)
        new(Keys.ESSDashboard, "ESS Portal Access", Modules.SelfService, "Access the Employee Self-Service portal"),
        new(Keys.ESSMyAttendance, "My Attendance", Modules.SelfService, "View personal punch history and calendar"),
        new(Keys.ESSApplyLeave, "Apply Personal Leave", Modules.SelfService, "Submit leave and regularization requests"),
        new(Keys.ESSMyPayslips, "My Payslips", Modules.SelfService, "Download monthly personal payslips"),
        new(Keys.ESSMyRoster, "My Shift Roster", Modules.SelfService, "View personal assigned shift roster")
    };
}

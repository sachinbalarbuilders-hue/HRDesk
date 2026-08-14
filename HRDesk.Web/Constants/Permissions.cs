namespace HRDesk.Web.Constants;

public static class AppPermissions
{
    // Permission Scopes
    public static class Scopes
    {
        public const string All = "All";                 // Entire organization
        public const string Reporting = "Reporting";     // Reporting team (direct reportees) + own
        public const string Department = "Department";   // Entire department + own
        public const string Own = "Own";                 // Logged-in user's own profile/records only
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
        bool SupportsScope = false);

    public static readonly List<PermissionDefinition> All = new()
    {
        // Employees
        new(Keys.EmployeesView, "View Employees", Modules.Employees, "View employee profiles and directories", SupportsScope: true),
        new(Keys.EmployeesCreate, "Create Employees", Modules.Employees, "Add new employees to the organization", SupportsScope: true),
        new(Keys.EmployeesEdit, "Edit Employees", Modules.Employees, "Update employee personal and job details", SupportsScope: true),
        new(Keys.EmployeesDelete, "Delete Employees", Modules.Employees, "Archive or remove employee records", SupportsScope: true),
        new(Keys.EmployeesViewSalary, "View Salary Info", Modules.Employees, "View compensation, CTC, and bank info", SupportsScope: true),

        // Attendance
        new(Keys.AttendanceView, "View Attendance Logs", Modules.Attendance, "View biometric logs and daily attendance", SupportsScope: true),
        new(Keys.AttendanceProcess, "Process Attendance", Modules.Attendance, "Run attendance calculation engine"),
        new(Keys.AttendanceRoster, "Manage Shift Roster", Modules.Attendance, "Assign and manage weekly shift rosters", SupportsScope: true),
        new(Keys.AttendanceMonthlySheet, "View Monthly Sheet", Modules.Attendance, "Access aggregated monthly attendance sheet", SupportsScope: true),
        new(Keys.AttendanceRegularize, "Approve Regularization", Modules.Attendance, "Approve or reject attendance regularizations", SupportsScope: true),

        // Leaves & Comp-Off
        new(Keys.LeavesView, "View Leaves", Modules.Leaves, "View submitted leave applications", SupportsScope: true),
        new(Keys.LeavesApply, "Apply Leaves (Admin)", Modules.Leaves, "Submit leave on behalf of staff"),
        new(Keys.LeavesApprove, "Approve Leaves", Modules.Leaves, "Approve or reject leave requests", SupportsScope: true),
        new(Keys.LeavesManageTypes, "Manage Leave Types", Modules.Leaves, "Configure leave quotas and rules"),
        new(Keys.LeavesManageAllocations, "Manage Allocations", Modules.Leaves, "Credit and adjust leave balances"),
        new(Keys.CompOffApprove, "Approve Comp-Off", Modules.Leaves, "Approve weekend / overtime comp-off credits", SupportsScope: true),

        // Payroll & Loans
        new(Keys.PayrollView, "View Payroll", Modules.Payroll, "View salary statements and payroll reports"),
        new(Keys.PayrollProcess, "Process Payroll", Modules.Payroll, "Calculate monthly payroll and generate slips"),
        new(Keys.PayrollManageSalary, "Manage Salary Structure", Modules.Payroll, "Configure salary components and formulas"),
        new(Keys.PayrollManageLoans, "Manage Loans & Advances", Modules.Payroll, "Approve and track employee loans"),

        // Masters
        new(Keys.MastersDepartments, "Manage Departments", Modules.Masters, "Create, edit, and delete departments"),
        new(Keys.MastersDesignations, "Manage Designations", Modules.Masters, "Create, edit, and delete designations"),
        new(Keys.MastersOrganizations, "Manage Organizations", Modules.Masters, "Manage company branches and organizations"),

        // Shifts & Schedule
        new(Keys.ShiftsManage, "Manage Shifts", Modules.Shifts, "Create and edit shift timings and grace periods"),
        new(Keys.HolidaysManage, "Manage Holidays", Modules.Shifts, "Configure annual holiday calendars"),

        // Recruitment
        new(Keys.RecruitmentCandidates, "Manage Candidates", Modules.Recruitment, "Candidate pipeline and resumes"),
        new(Keys.RecruitmentInterviews, "Schedule Interviews", Modules.Recruitment, "Interview scheduling and evaluations"),

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

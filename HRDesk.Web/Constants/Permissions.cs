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
        public const string EditAllDetails = "All Details";

        // Delete Scopes
        public const string DeleteSoft = "Soft Delete";
        public const string DeletePermanent = "Permanent Delete";
        public const string DeleteBulk = "Bulk Delete";
    }

    // Modules matching actual system sections
    public static class Modules
    {
        public const string Employees = "Employees";
        public const string Attendance = "Attendance";
        public const string Regularizations = "Regularizations";
        public const string ShiftsAndRoster = "Shifts & Roster";
        public const string Leaves = "Leaves";
        public const string CompOff = "Comp-Off";
        public const string Payroll = "Payroll & Loans";
        public const string Masters = "Masters & Structure";
        public const string Recruitment = "Recruitment";
        public const string System = "System & Settings";
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

        // 3. Regularizations Module
        public const string AttendanceRegularize = "Attendance.Regularize";
        public const string RegularizationsView = "Regularizations.View";
        public const string RegularizationsEdit = "Regularizations.Edit";
        public const string RegularizationsApprove = "Regularizations.Approve";
        public const string RegularizationsDelete = "Regularizations.Delete";

        // 4. Shifts & Roster Module
        public const string ShiftsManage = "Shifts.Manage";
        public const string AttendanceRoster = "Attendance.Roster";
        public const string HolidaysManage = "Holidays.Manage";

        // 5. Leaves Module
        public const string LeavesView = "Leaves.View";
        public const string LeavesApply = "Leaves.Apply";
        public const string LeavesEdit = "Leaves.Edit";
        public const string LeavesApprove = "Leaves.Approve";
        public const string LeavesDelete = "Leaves.Delete";
        public const string LeavesManageTypes = "Leaves.ManageTypes";
        public const string LeavesManageAllocations = "Leaves.ManageAllocations";

        // 6. Comp-Off Module
        public const string CompOffView = "CompOff.View";
        public const string CompOffApply = "CompOff.Apply";
        public const string CompOffEdit = "CompOff.Edit";
        public const string CompOffApprove = "CompOff.Approve";
        public const string CompOffDelete = "CompOff.Delete";

        // 7. Payroll & Loans Module
        public const string PayrollView = "Payroll.View";
        public const string PayrollProcess = "Payroll.Process";
        public const string PayrollManageSalary = "Payroll.ManageSalary";
        public const string PayrollManageLoans = "Payroll.ManageLoans";

        // 7. Masters & Structure Module
        public const string MastersDepartments = "Masters.Departments";
        public const string MastersDesignations = "Masters.Designations";
        public const string MastersOrganizations = "Masters.Organizations";

        // 8. Recruitment Module
        public const string RecruitmentCandidates = "Recruitment.Candidates";
        public const string RecruitmentInterviews = "Recruitment.Interviews";

        // 9. System & Settings Module
        public const string SystemDevices = "System.Devices";
        public const string SystemRoles = "System.Roles";
        public const string SystemSettings = "System.Settings";
        public const string SystemLogs = "System.Logs";
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
        // 1. Employees
        new(Keys.EmployeesView, "View Scope", Modules.Employees, "View employee profiles and directories", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch",
            SubSections: new[] { "Work", "Documents", "Attendance", "Action", "Personal", "Credentials", "Other", "Activity" }),

        new(Keys.EmployeesCreate, "Create Scope", Modules.Employees, "Add new employees to the organization", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.EmployeesEdit, "Edit Scope", Modules.Employees, "Update employee personal and job details", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Basic Information", "All Details" },
            DefaultScope: "All Details"),

        new(Keys.EmployeesDelete, "Delete Scope", Modules.Employees, "Archive or remove employee records", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.EmployeesViewSalary, "View Salary Info", Modules.Employees, "View compensation, CTC, and bank info", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // 2. Attendance
        new(Keys.AttendanceView, "View Scope", Modules.Attendance, "View biometric logs, daily attendance, and monthly registers", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // 3. Regularizations
        new(Keys.RegularizationsView, "View Scope", Modules.Regularizations, "View attendance regularization requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceRegularize, "Create Scope", Modules.Regularizations, "Submit attendance regularization requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RegularizationsEdit, "Edit Scope", Modules.Regularizations, "Edit submitted regularization requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RegularizationsApprove, "Approve Scope", Modules.Regularizations, "Approve or reject attendance regularizations", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RegularizationsDelete, "Delete Scope", Modules.Regularizations, "Archive or permanently delete regularization requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // 4. Shifts & Roster
        new(Keys.ShiftsManage, "Manage Shifts", Modules.ShiftsAndRoster, "Create and edit shift timings and grace periods",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AttendanceRoster, "Roster Scope", Modules.ShiftsAndRoster, "Assign and manage shift rosters", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.HolidaysManage, "Manage Holidays", Modules.ShiftsAndRoster, "Configure annual holiday calendars",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        // 5. Leaves
        new(Keys.LeavesView, "View Scope", Modules.Leaves, "View submitted leave applications", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesApply, "Create Scope", Modules.Leaves, "Submit leave on behalf of staff", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesEdit, "Edit Scope", Modules.Leaves, "Edit submitted leave applications", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesApprove, "Approve Scope", Modules.Leaves, "Approve or reject leave requests", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.LeavesDelete, "Delete Scope", Modules.Leaves, "Archive or permanently delete leave applications", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.LeavesManageTypes, "Manage Leave Types", Modules.Leaves, "Configure leave quotas and rules"),
        new(Keys.LeavesManageAllocations, "Manage Allocations", Modules.Leaves, "Credit and adjust leave balances"),

        // 6. Comp-Off
        new(Keys.CompOffView, "View Scope", Modules.CompOff, "View comp-off balance and duty credits", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.CompOffApply, "Create Scope", Modules.CompOff, "Request or grant comp-off duty credits", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.CompOffEdit, "Edit Scope", Modules.CompOff, "Edit comp-off credit records", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.CompOffApprove, "Approve Scope", Modules.CompOff, "Approve or reject weekend / overtime comp-off credits", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.CompOffDelete, "Delete Scope", Modules.CompOff, "Archive or permanently delete comp-off records", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // 7. Payroll & Loans
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

        // 7. Masters & Structure
        new(Keys.MastersDepartments, "Manage Departments", Modules.Masters, "Create, edit, and delete departments"),
        new(Keys.MastersDesignations, "Manage Designations", Modules.Masters, "Create, edit, and delete designations"),
        new(Keys.MastersOrganizations, "Manage Organizations", Modules.Masters, "Manage company branches and organizations"),

        // 8. Recruitment
        new(Keys.RecruitmentCandidates, "Manage Candidates", Modules.Recruitment, "Candidate pipeline and resumes",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RecruitmentInterviews, "Schedule Interviews", Modules.Recruitment, "Interview scheduling and evaluations",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // 9. System & Settings
        new(Keys.SystemDevices, "Manage Biometric Devices", Modules.System, "Configure LAN/Cloud biometric sync & machines"),
        new(Keys.SystemRoles, "Manage Roles & Permissions", Modules.System, "Create, edit, and delete custom roles"),
        new(Keys.SystemSettings, "Manage System Settings", Modules.System, "Configure general company settings"),
        new(Keys.SystemLogs, "View Service Logs", Modules.System, "Inspect audit trails and background job logs")
    };
}

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
        public const string Dashboard = "Dashboard";
        public const string Employees = "Employees";
        public const string Attendance = "Attendance";
        public const string Regularizations = "Regularizations";
        public const string ShiftsAndRoster = "Shifts & Roster";
        public const string Holidays = "Holidays";
        public const string Announcements = "Announcements";
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
        // 0. Dashboard Module
        public const string DashboardView = "Dashboard.View";

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
        public const string ShiftsView = "Shifts.View";
        public const string ShiftsCreate = "Shifts.Create";
        public const string ShiftsEdit = "Shifts.Edit";
        public const string ShiftsDelete = "Shifts.Delete";
        public const string ShiftsManage = "Shifts.Manage";
        public const string ShiftsRosterView = "Shifts.Roster.View";
        public const string ShiftsRosterAssign = "Shifts.Roster.Assign";
        public const string AttendanceRoster = "Attendance.Roster"; // Legacy alias
        public const string ShiftsRequestsView = "Shifts.Requests.View";
        public const string ShiftsRequestsApply = "Shifts.Requests.Apply";
        public const string ShiftsRequestsApprove = "Shifts.Requests.Approve";
        public const string ShiftsRequestsDelete = "Shifts.Requests.Delete";
        public const string ShiftsRequestsManage = "Shifts.Requests.Manage";
        public const string HolidaysView = "Holidays.View";
        public const string HolidaysCreate = "Holidays.Create";
        public const string HolidaysEdit = "Holidays.Edit";
        public const string HolidaysDelete = "Holidays.Delete";
        public const string HolidaysManage = "Holidays.Manage";

        // Announcements Module
        public const string AnnouncementsView = "Announcements.View";
        public const string AnnouncementsCreate = "Announcements.Create";
        public const string AnnouncementsEdit = "Announcements.Edit";
        public const string AnnouncementsDelete = "Announcements.Delete";
        public const string AnnouncementsManage = "Announcements.Manage";

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

        // 7. Masters & Structure Module (Standardized View/Create/Edit/Delete)
        public const string MastersOrganizationsView = "Masters.Organizations.View";
        public const string MastersOrganizationsCreate = "Masters.Organizations.Create";
        public const string MastersOrganizationsEdit = "Masters.Organizations.Edit";
        public const string MastersOrganizationsDelete = "Masters.Organizations.Delete";
        public const string MastersOrganizations = "Masters.Organizations"; // Legacy alias

        public const string MastersDepartmentsView = "Masters.Departments.View";
        public const string MastersDepartmentsCreate = "Masters.Departments.Create";
        public const string MastersDepartmentsEdit = "Masters.Departments.Edit";
        public const string MastersDepartmentsDelete = "Masters.Departments.Delete";
        public const string MastersDepartments = "Masters.Departments"; // Legacy alias

        public const string MastersDesignationsView = "Masters.Designations.View";
        public const string MastersDesignationsCreate = "Masters.Designations.Create";
        public const string MastersDesignationsEdit = "Masters.Designations.Edit";
        public const string MastersDesignationsDelete = "Masters.Designations.Delete";
        public const string MastersDesignations = "Masters.Designations"; // Legacy alias

        // Leave Types Master
        public const string LeavesTypesView = "Leaves.Types.View";
        public const string LeavesTypesCreate = "Leaves.Types.Create";
        public const string LeavesTypesEdit = "Leaves.Types.Edit";
        public const string LeavesTypesDelete = "Leaves.Types.Delete";

        // 8. Recruitment Module
        public const string RecruitmentCandidates = "Recruitment.Candidates";
        public const string RecruitmentInterviews = "Recruitment.Interviews";

        // 9. System & Settings Module
        public const string SystemDevices = "System.Devices";
        public const string SystemRolesView = "System.Roles.View";
        public const string SystemRolesEdit = "System.Roles.Edit";
        public const string SystemRoles = "System.Roles"; // Legacy alias
        public const string SystemSettingsView = "System.Settings.View";
        public const string SystemSettingsEdit = "System.Settings.Edit";
        public const string SystemSettings = "System.Settings"; // Legacy alias
        public const string SystemLogsView = "System.Logs.View";
        public const string SystemLogs = "System.Logs"; // Legacy alias
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
        // 0. Dashboard
        new(Keys.DashboardView, "View Scope", Modules.Dashboard, "View team & organization metrics, statistics, and pending action queues", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch", "All" },
            DefaultScope: "Own"),

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
        new(Keys.ShiftsRosterView, "View Shift Roster", Modules.ShiftsAndRoster, "View employee weekly shift schedule matrix", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.ShiftsRosterAssign, "Assign Shift Roster", Modules.ShiftsAndRoster, "Assign duty shifts, generate cycle rosters, and import roster CSV", 
            SupportsScope: true, 
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.ShiftsRequestsView, "View Shift Requests", Modules.ShiftsAndRoster, "View employee shift change requests",
            SupportsScope: true,
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.ShiftsRequestsApply, "Apply Shift Request", Modules.ShiftsAndRoster, "Submit shift change and swap requests",
            SupportsScope: true,
            ScopeOptions: new[] { "Own", "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Own"),

        new(Keys.ShiftsRequestsApprove, "Approve Shift Request", Modules.ShiftsAndRoster, "Approve or reject employee shift change requests",
            SupportsScope: true,
            ScopeOptions: new[] { "Reporting To", "Department", "Own Branch" },
            DefaultScope: "Reporting To"),

        new(Keys.ShiftsRequestsDelete, "Delete Shift Requests", Modules.ShiftsAndRoster, "Archive or permanently delete shift change requests",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.HolidaysView, "View Scope", Modules.Holidays, "View company and branch holiday schedules",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.HolidaysCreate, "Create Scope", Modules.Holidays, "Register new holiday events in the calendar",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.HolidaysEdit, "Edit Scope", Modules.Holidays, "Update holiday dates, names, or applicability",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.HolidaysDelete, "Delete Scope", Modules.Holidays, "Archive or delete holiday calendar entries",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // Announcements
        new(Keys.AnnouncementsView, "View Scope", Modules.Announcements, "View published company notices and bulletins",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AnnouncementsCreate, "Create Scope", Modules.Announcements, "Post new company notices and announcements",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AnnouncementsEdit, "Edit Scope", Modules.Announcements, "Edit, pin, or upload media for announcements",
            SupportsScope: true,
            ScopeOptions: new[] { "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.AnnouncementsDelete, "Delete Scope", Modules.Announcements, "Archive or permanently delete announcements",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

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

        // Leave Allocations
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

        // 8. Masters & Structure (Standardized View/Create/Edit/Delete)
        new(Keys.MastersOrganizationsView, "View Organizations", Modules.Masters, "View company branches and organizations"),
        new(Keys.MastersOrganizationsCreate, "Create Organization", Modules.Masters, "Add new branches and organizations"),
        new(Keys.MastersOrganizationsEdit, "Edit Organization", Modules.Masters, "Update company and branch settings"),
        new(Keys.MastersOrganizationsDelete, "Delete Organizations", Modules.Masters, "Archive or delete branches",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.MastersDepartmentsView, "View Departments", Modules.Masters, "View department list"),
        new(Keys.MastersDepartmentsCreate, "Create Department", Modules.Masters, "Add new department"),
        new(Keys.MastersDepartmentsEdit, "Edit Department", Modules.Masters, "Edit department details"),
        new(Keys.MastersDepartmentsDelete, "Delete Departments", Modules.Masters, "Archive or delete department",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        new(Keys.MastersDesignationsView, "View Designations", Modules.Masters, "View designation list"),
        new(Keys.MastersDesignationsCreate, "Create Designation", Modules.Masters, "Add new designation"),
        new(Keys.MastersDesignationsEdit, "Edit Designation", Modules.Masters, "Edit designation details"),
        new(Keys.MastersDesignationsDelete, "Delete Designations", Modules.Masters, "Archive or delete designation",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // Leave Types Master
        new(Keys.LeavesTypesView, "View Leave Types", Modules.Masters, "View leave categories and quotas"),
        new(Keys.LeavesTypesCreate, "Create Leave Type", Modules.Masters, "Add new leave categories"),
        new(Keys.LeavesTypesEdit, "Edit Leave Type", Modules.Masters, "Update leave quotas and rules"),
        new(Keys.LeavesTypesDelete, "Delete Leave Types", Modules.Masters, "Archive or delete leave types",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // Work Shifts Master
        new(Keys.ShiftsView, "View Work Shifts", Modules.Masters, "View work shifts and timings"),
        new(Keys.ShiftsCreate, "Create Work Shift", Modules.Masters, "Add new work shifts"),
        new(Keys.ShiftsEdit, "Edit Work Shift", Modules.Masters, "Update shift timings and grace periods"),
        new(Keys.ShiftsDelete, "Delete Work Shifts", Modules.Masters, "Archive or delete work shifts",
            SupportsScope: true,
            ScopeOptions: new[] { "Soft Delete", "Permanent Delete", "Bulk Delete" },
            DefaultScope: "Soft Delete"),

        // 9. Recruitment
        new(Keys.RecruitmentCandidates, "Manage Candidates", Modules.Recruitment, "Candidate pipeline and resumes",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        new(Keys.RecruitmentInterviews, "Schedule Interviews", Modules.Recruitment, "Interview scheduling and evaluations",
            SupportsScope: true,
            ScopeOptions: new[] { "Department", "Own Branch" },
            DefaultScope: "Own Branch"),

        // 10. System & Settings
        new(Keys.SystemDevices, "Manage Biometric Devices", Modules.System, "Configure LAN/Cloud biometric sync & machines"),
        new(Keys.SystemRolesView, "View Roles", Modules.System, "View roles and permission matrix"),
        new(Keys.SystemRolesEdit, "Manage Roles", Modules.System, "Create, edit, and delete custom roles"),
        new(Keys.SystemSettingsView, "View System Settings", Modules.System, "View general system settings and configurations"),
        new(Keys.SystemSettingsEdit, "Edit System Settings", Modules.System, "Configure general company settings and email"),
        new(Keys.SystemLogsView, "View Service Logs", Modules.System, "Inspect audit trails and background job logs")
    };

    public static string GetDefaultAdminScope(PermissionDefinition perm)
    {
        if (perm.Key.EndsWith(".Delete", StringComparison.OrdinalIgnoreCase))
            return Scopes.DeletePermanent;

        if (perm.Key.Equals(Keys.EmployeesEdit, StringComparison.OrdinalIgnoreCase))
            return Scopes.EditAllDetails;

        if (perm.Module == Modules.Masters || perm.Module == Modules.System)
            return Scopes.All;

        return Scopes.OwnBranch;
    }
}

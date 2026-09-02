using HRDesk.Web.Constants;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services.Infrastructure;

/// <summary>
/// Whitelist mapping the URL segment used by the generic archive endpoints to a CLR entity type,
/// together with the permission required to operate on it.
///
/// This is a whitelist on purpose: the generic controller must never resolve an arbitrary
/// type name supplied by a client.
///
/// To expose a new entity to the shared archive endpoints:
///   1. make the entity implement IArchivable (+ add the migration columns)
///   2. add one line here
/// No controller changes needed.
/// </summary>
public static class ArchivableRegistry
{
    public sealed record Entry(string Slug, Type EntityType, string DeletePermission, string ViewPermission, string DisplayName);

    private static readonly Dictionary<string, Entry> _map = new(StringComparer.OrdinalIgnoreCase);

    static ArchivableRegistry()
    {
        Register("departments",        typeof(Department),               AppPermissions.Keys.MastersDepartmentsDelete,   AppPermissions.Keys.MastersDepartmentsView,   "Department");
        Register("designations",       typeof(Designation),              AppPermissions.Keys.MastersDesignationsDelete,  AppPermissions.Keys.MastersDesignationsView,  "Designation");
        Register("leave-types",        typeof(LeaveType),                AppPermissions.Keys.LeavesTypesDelete,          AppPermissions.Keys.LeavesTypesView,          "Leave type");
        Register("shifts",             typeof(Shift),                    AppPermissions.Keys.ShiftsDelete,               AppPermissions.Keys.ShiftsView,               "Shift");
        Register("shift-cycles",       typeof(ShiftCycle),               AppPermissions.Keys.ShiftsDelete,               AppPermissions.Keys.ShiftsView,               "Shift cycle");
        Register("cycles",             typeof(ShiftCycle),               AppPermissions.Keys.ShiftsDelete,               AppPermissions.Keys.ShiftsView,               "Shift cycle");
        Register("holidays",           typeof(Holiday),                  AppPermissions.Keys.HolidaysDelete,             AppPermissions.Keys.HolidaysView,             "Holiday");
        Register("branches",           typeof(Branch),                   AppPermissions.Keys.MastersOrganizationsDelete, AppPermissions.Keys.MastersOrganizationsView, "Branch");
        Register("organizations",      typeof(Branch),                   AppPermissions.Keys.MastersOrganizationsDelete, AppPermissions.Keys.MastersOrganizationsView, "Branch");
        Register("roles",              typeof(Role),                     AppPermissions.Keys.SystemRolesEdit,            AppPermissions.Keys.SystemRolesView,          "Role");
        Register("pay-groups",         typeof(PayGroup),                 AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "Pay group");
        Register("salary-templates",   typeof(SalaryStructureTemplate),  AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "Salary template");
        Register("templates",          typeof(SalaryStructureTemplate),  AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "Salary template");
        Register("salary-components",  typeof(SalaryComponent),          AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "Salary component");
        Register("components",         typeof(SalaryComponent),          AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "Salary component");
        Register("pt-slabs",           typeof(ProfessionalTaxSlab),      AppPermissions.Keys.PayrollManageSalary,        AppPermissions.Keys.PayrollView,              "PT slab");
        Register("loan-types",         typeof(LoanType),                 AppPermissions.Keys.PayrollManageLoans,         AppPermissions.Keys.PayrollView,              "Loan type");
        Register("loans",              typeof(EmployeeLoan),             AppPermissions.Keys.PayrollManageLoans,         AppPermissions.Keys.PayrollView,              "Loan");
        Register("announcements",      typeof(Announcement),             AppPermissions.Keys.AnnouncementsDelete,        AppPermissions.Keys.AnnouncementsView,        "Announcement");
        Register("employees",          typeof(Employee),                 AppPermissions.Keys.EmployeesDelete,            AppPermissions.Keys.EmployeesView,            "Employee");
        Register("employee-documents", typeof(EmployeeDocument),         AppPermissions.Keys.EmployeesEdit,              AppPermissions.Keys.EmployeesView,            "Document");
        Register("documents",          typeof(EmployeeDocument),         AppPermissions.Keys.EmployeesEdit,              AppPermissions.Keys.EmployeesView,            "Document");
        Register("payroll",            typeof(PayrollMaster),            AppPermissions.Keys.PayrollProcess,             AppPermissions.Keys.PayrollView,              "Payroll record");
        Register("candidates",         typeof(HRDesk.Web.Areas.Recruitment.Models.Candidate),         AppPermissions.Keys.RecruitmentCandidates, AppPermissions.Keys.RecruitmentCandidates, "Candidate");
        Register("interviews",         typeof(HRDesk.Web.Areas.Recruitment.Models.InterviewSchedule), AppPermissions.Keys.RecruitmentInterviews, AppPermissions.Keys.RecruitmentInterviews, "Interview");
        Register("employee-exits",     typeof(EmployeeExit),             AppPermissions.Keys.EmployeesEdit,              AppPermissions.Keys.EmployeesView,            "Employee exit");
        Register("exits",              typeof(EmployeeExit),             AppPermissions.Keys.EmployeesEdit,              AppPermissions.Keys.EmployeesView,            "Employee exit");
        Register("shift-change-requests", typeof(ShiftChangeRequest),    AppPermissions.Keys.ShiftsRequestsDelete,       AppPermissions.Keys.ShiftsRequestsView,       "Shift change request");
        Register("shift-requests",     typeof(ShiftChangeRequest),       AppPermissions.Keys.ShiftsRequestsDelete,       AppPermissions.Keys.ShiftsRequestsView,       "Shift change request");
    }

    private static void Register(string slug, Type type, string deletePermission, string viewPermission, string displayName)
    {
        if (!typeof(IArchivable).IsAssignableFrom(type))
            throw new InvalidOperationException($"{type.Name} does not implement IArchivable.");

        _map[slug] = new Entry(slug, type, deletePermission, viewPermission, displayName);
    }

    public static bool TryResolve(string slug, out Entry entry) => _map.TryGetValue(slug, out entry!);

    public static IReadOnlyCollection<Entry> All => _map.Values;
}

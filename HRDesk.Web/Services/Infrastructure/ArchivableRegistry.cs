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
    public sealed record Entry(string Slug, Type EntityType, string Permission, string DisplayName);

    private static readonly Dictionary<string, Entry> _map = new(StringComparer.OrdinalIgnoreCase);

    static ArchivableRegistry()
    {
        Register("departments",        typeof(Department),               AppPermissions.Keys.MastersDepartments,   "Department");
        Register("designations",       typeof(Designation),              AppPermissions.Keys.MastersDesignations,  "Designation");
        Register("leave-types",        typeof(LeaveType),                AppPermissions.Keys.LeavesManageTypes,    "Leave type");
        Register("shifts",             typeof(Shift),                    AppPermissions.Keys.ShiftsManage,         "Shift");
        Register("shift-cycles",       typeof(ShiftCycle),               AppPermissions.Keys.ShiftsManage,         "Shift cycle");
        Register("cycles",             typeof(ShiftCycle),               AppPermissions.Keys.ShiftsManage,         "Shift cycle");
        Register("holidays",           typeof(Holiday),                  AppPermissions.Keys.HolidaysManage,       "Holiday");
        Register("branches",           typeof(Branch),                   AppPermissions.Keys.MastersOrganizations, "Branch");
        Register("organizations",      typeof(Branch),                   AppPermissions.Keys.MastersOrganizations, "Branch");
        Register("roles",              typeof(Role),                     AppPermissions.Keys.SystemRoles,          "Role");
        Register("pay-groups",         typeof(PayGroup),                 AppPermissions.Keys.PayrollManageSalary,  "Pay group");
        Register("salary-templates",   typeof(SalaryStructureTemplate),  AppPermissions.Keys.PayrollManageSalary,  "Salary template");
        Register("templates",          typeof(SalaryStructureTemplate),  AppPermissions.Keys.PayrollManageSalary,  "Salary template");
        Register("salary-components",  typeof(SalaryComponent),          AppPermissions.Keys.PayrollManageSalary,  "Salary component");
        Register("components",         typeof(SalaryComponent),          AppPermissions.Keys.PayrollManageSalary,  "Salary component");
        Register("pt-slabs",           typeof(ProfessionalTaxSlab),      AppPermissions.Keys.PayrollManageSalary,  "PT slab");
        Register("loan-types",         typeof(LoanType),                 AppPermissions.Keys.PayrollManageLoans,   "Loan type");
        Register("loans",              typeof(EmployeeLoan),             AppPermissions.Keys.PayrollManageLoans,   "Loan");
        Register("announcements",      typeof(Announcement),             AppPermissions.Keys.SystemSettings,       "Announcement");
        Register("employees",          typeof(Employee),                 AppPermissions.Keys.EmployeesEdit,        "Employee");
        Register("employee-documents", typeof(EmployeeDocument),         AppPermissions.Keys.EmployeesEdit,        "Document");
        Register("documents",          typeof(EmployeeDocument),         AppPermissions.Keys.EmployeesEdit,        "Document");
        Register("leaves",             typeof(LeaveApplication),         AppPermissions.Keys.LeavesApply,          "Leave application");
        Register("regularizations",    typeof(AttendanceRegularization), AppPermissions.Keys.AttendanceRegularize, "Regularization");
        Register("payroll",            typeof(PayrollMaster),            AppPermissions.Keys.PayrollProcess,       "Payroll record");
        Register("candidates",         typeof(HRDesk.Web.Areas.Recruitment.Models.Candidate),         AppPermissions.Keys.RecruitmentCandidates, "Candidate");
        Register("interviews",         typeof(HRDesk.Web.Areas.Recruitment.Models.InterviewSchedule), AppPermissions.Keys.RecruitmentInterviews, "Interview");
    }

    private static void Register(string slug, Type type, string permission, string displayName)
    {
        if (!typeof(IArchivable).IsAssignableFrom(type))
            throw new InvalidOperationException($"{type.Name} does not implement IArchivable.");

        _map[slug] = new Entry(slug, type, permission, displayName);
    }

    public static bool TryResolve(string slug, out Entry entry) => _map.TryGetValue(slug, out entry!);

    public static IReadOnlyCollection<Entry> All => _map.Values;
}

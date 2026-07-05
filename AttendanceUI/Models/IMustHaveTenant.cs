namespace AttendanceUI.Models;

public interface IMustHaveTenant
{
    int OrganizationId { get; set; }
    Organization? Organization { get; set; }
}

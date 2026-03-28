using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceUI.Models;

public sealed class Employee
{
    public int EmployeeId { get; set; }

    public string EmployeeName { get; set; } = "";

    public int? DepartmentId { get; set; }

    public int? DesignationId { get; set; }

    public int? ShiftId { get; set; }

    public string? Phone { get; set; }

    public DateOnly? JoiningDate { get; set; }

    public DateOnly? LastWorkingDate { get; set; }

    public DateOnly? ProbationStart { get; set; }

    public DateOnly? ProbationEnd { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? Weekoff { get; set; }

    public string? Status { get; set; }

    public Department? Department { get; set; }

    public Designation? Designation { get; set; }

    public Shift? Shift { get; set; }

    [Column("device_synced")]
    public int DeviceSynced { get; set; } // 0 = not in machine, 1 = in machine

    [Column("device_sync_error")]
    public string? DeviceSyncError { get; set; }

}

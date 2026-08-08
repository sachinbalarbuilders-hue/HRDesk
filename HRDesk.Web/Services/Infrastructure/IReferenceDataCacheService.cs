using System.Collections.Generic;
using System.Threading.Tasks;
using HRDesk.Web.Models;

namespace HRDesk.Web.Services;

public interface IReferenceDataCacheService
{
    Task<List<Department>> GetDepartmentsAsync();
    Task<List<Designation>> GetDesignationsAsync();
    Task<List<Shift>> GetShiftsAsync();
    Task<List<LeaveType>> GetLeaveTypesAsync();
    
    void EvictDepartmentsCache();
    void EvictDesignationsCache();
    void EvictShiftsCache();
    void EvictLeaveTypesCache();
}

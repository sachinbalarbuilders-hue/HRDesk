using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace HRDesk.Web.Services;

public class ReferenceDataCacheService : IReferenceDataCacheService
{
    private readonly IMemoryCache _cache;
    private readonly IServiceProvider _serviceProvider;
    
    private const string DepartmentsKey = "ref_departments";
    private const string DesignationsKey = "ref_designations";
    private const string ShiftsKey = "ref_shifts";
    private const string LeaveTypesKey = "ref_leavetypes";
    
    private static readonly TimeSpan DefaultExpiration = TimeSpan.FromHours(12);

    public ReferenceDataCacheService(IMemoryCache cache, IServiceProvider serviceProvider)
    {
        _cache = cache;
        _serviceProvider = serviceProvider;
    }

    public async Task<List<Department>> GetDepartmentsAsync()
    {
        if (!_cache.TryGetValue(DepartmentsKey, out List<Department>? departments))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            departments = await db.Departments.Where(d => d.Status == "active").OrderBy(d => d.DepartmentName).ToListAsync();
            _cache.Set(DepartmentsKey, departments, DefaultExpiration);
        }
        return departments ?? new List<Department>();
    }

    public async Task<List<Designation>> GetDesignationsAsync()
    {
        if (!_cache.TryGetValue(DesignationsKey, out List<Designation>? designations))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            designations = await db.Designations.Where(d => d.Status == "active").OrderBy(d => d.DesignationName).ToListAsync();
            _cache.Set(DesignationsKey, designations, DefaultExpiration);
        }
        return designations ?? new List<Designation>();
    }

    public async Task<List<Shift>> GetShiftsAsync()
    {
        if (!_cache.TryGetValue(ShiftsKey, out List<Shift>? shifts))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            shifts = await db.Shifts.Where(s => s.Status == "active").OrderBy(s => s.ShiftName).ToListAsync();
            _cache.Set(ShiftsKey, shifts, DefaultExpiration);
        }
        return shifts ?? new List<Shift>();
    }

    public async Task<List<LeaveType>> GetLeaveTypesAsync()
    {
        if (!_cache.TryGetValue(LeaveTypesKey, out List<LeaveType>? leaveTypes))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<BiometricAttendanceDbContext>();
            leaveTypes = await db.LeaveTypes.Where(l => l.Status == "Active").OrderBy(l => l.Name).ToListAsync();
            _cache.Set(LeaveTypesKey, leaveTypes, DefaultExpiration);
        }
        return leaveTypes ?? new List<LeaveType>();
    }

    public void EvictDepartmentsCache() => _cache.Remove(DepartmentsKey);
    public void EvictDesignationsCache() => _cache.Remove(DesignationsKey);
    public void EvictShiftsCache() => _cache.Remove(ShiftsKey);
    public void EvictLeaveTypesCache() => _cache.Remove(LeaveTypesKey);
}

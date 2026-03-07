using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace AttendanceUI.Services;

public class SequenceService : ISequenceService
{
    private readonly BiometricAttendanceDbContext _db;

    public SequenceService(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    public async Task<string> GenerateApplicationNumberAsync(DateOnly requestDate)
    {
        int year = requestDate.Year;
        int month = requestDate.Month;

        // Scan actual tables for the highest used number this month
        int maxActual = await GetMaxAppNumberAsync(year, month);

        // The next number is strictly maxActual + 1 (recycling deleted numbers)
        int nextValue = maxActual + 1;

        // We can optionally keep the sequence table updated for history/auditing, 
        // but we won't use it to prevent recycling.
        var sequence = await _db.ApplicationSequences
            .FirstOrDefaultAsync(s => s.Year == year && s.Month == month);

        if (sequence == null)
        {
            sequence = new ApplicationSequence
            {
                Year = year,
                Month = month,
                CurrentValue = nextValue,
                UpdatedAt = DateTime.Now
            };
            _db.ApplicationSequences.Add(sequence);
        }
        else
        {
            sequence.CurrentValue = nextValue;
            sequence.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();

        string monthName = CultureInfo.InvariantCulture.DateTimeFormat.GetAbbreviatedMonthName(month).ToUpper();
        return $"{monthName} {nextValue}";
    }

    public async Task<string> PeekNextApplicationNumberAsync(DateOnly requestDate)
    {
        int year = requestDate.Year;
        int month = requestDate.Month;

        // Strictly rely on actual live records to allow recycling
        int maxActual = await GetMaxAppNumberAsync(year, month);

        string monthName = CultureInfo.InvariantCulture.DateTimeFormat.GetAbbreviatedMonthName(month).ToUpper();
        return $"{monthName} {maxActual + 1}";
    }

    /// <summary>Scans all 3 tables separately to find the highest app number (avoids SQL UNION collation issues).</summary>
    private async Task<int> GetMaxAppNumberAsync(int year, int month)
    {
        var regAppNos = await _db.AttendanceRegularizations
            .Where(r => r.RequestDate.Year == year && r.RequestDate.Month == month && r.ApplicationNumber != null)
            .Select(r => r.ApplicationNumber)
            .ToListAsync();

        var leaveAppNos = await _db.LeaveApplications
            .Where(l => l.StartDate.Year == year && l.StartDate.Month == month && l.ApplicationNumber != null)
            .Select(l => l.ApplicationNumber)
            .ToListAsync();

        var attendanceAppNos = await _db.DailyAttendance
            .Where(d => d.RecordDate.Year == year && d.RecordDate.Month == month && d.ApplicationNumber != null)
            .Select(d => d.ApplicationNumber)
            .ToListAsync();

        string monthPrefix = CultureInfo.InvariantCulture.DateTimeFormat.GetAbbreviatedMonthName(month).ToUpper();

        int maxVal = 0;
        foreach (var appNo in regAppNos.Concat(leaveAppNos).Concat(attendanceAppNos))
        {
            if (string.IsNullOrWhiteSpace(appNo)) continue;
            var parts = appNo.Split(' ');
            if (parts.Length == 2 && parts[0] == monthPrefix && int.TryParse(parts[1], out int val) && val > maxVal)
                maxVal = val;
        }
        return maxVal;
    }

    public async Task ResyncSequenceAsync(int year, int month)
    {
        // 1. Get all application numbers for this month/year from all 3 sources
        var regAppNos = await _db.AttendanceRegularizations
            .Where(r => r.RequestDate.Year == year && r.RequestDate.Month == month && r.ApplicationNumber != null)
            .Select(r => r.ApplicationNumber)
            .ToListAsync();

        var leaveAppNos = await _db.LeaveApplications
            .Where(l => l.StartDate.Year == year && l.StartDate.Month == month && l.ApplicationNumber != null)
            .Select(l => l.ApplicationNumber)
            .ToListAsync();

        var attendanceAppNos = await _db.DailyAttendance
            .Where(d => d.RecordDate.Year == year && d.RecordDate.Month == month && d.ApplicationNumber != null)
            .Select(d => d.ApplicationNumber)
            .ToListAsync();

        var allAppNos = regAppNos.Concat(leaveAppNos).Concat(attendanceAppNos).Distinct().ToList();

        string monthPrefix = CultureInfo.InvariantCulture.DateTimeFormat.GetAbbreviatedMonthName(month).ToUpper();

        // 2. Parse out the numbers
        int maxVal = 0;
        foreach (var appNo in allAppNos)
        {
            if (string.IsNullOrWhiteSpace(appNo)) continue;
            
            // Format is "MMM N", e.g. "FEB 50"
            var parts = appNo.Split(' ');
            if (parts.Length == 2 && parts[0] == monthPrefix && int.TryParse(parts[1], out int val))
            {
                if (val > maxVal) maxVal = val;
            }
        }

        // 3. Update or create the sequence record
        var sequence = await _db.ApplicationSequences
            .FirstOrDefaultAsync(s => s.Year == year && s.Month == month);

        if (sequence == null)
        {
            sequence = new ApplicationSequence
            {
                Year = year,
                Month = month,
                CurrentValue = maxVal,
                UpdatedAt = DateTime.Now
            };
            _db.ApplicationSequences.Add(sequence);
        }
        else
        {
            sequence.CurrentValue = maxVal;
            sequence.UpdatedAt = DateTime.Now;
        }

        await _db.SaveChangesAsync();
    }

    public async Task EnsureSequenceCatchUpAsync(DateOnly date, string appNo)
    {
        if (string.IsNullOrWhiteSpace(appNo)) return;

        int year = date.Year;
        int month = date.Month;
        
        // Parse the number part
        var parts = appNo.Split(' ');
        if (parts.Length != 2 || !int.TryParse(parts[1], out int val)) return;

        var sequence = await _db.ApplicationSequences
            .FirstOrDefaultAsync(s => s.Year == year && s.Month == month);

        bool needsUpdate = false;
        if (sequence == null)
        {
            sequence = new ApplicationSequence
            {
                Year = year,
                Month = month,
                CurrentValue = val, // Catch up to this value
                UpdatedAt = DateTime.Now
            };
            _db.ApplicationSequences.Add(sequence);
            needsUpdate = true;
        }
        else
        {
            if (val > sequence.CurrentValue)
            {
                sequence.CurrentValue = val; // Fast-forward
                sequence.UpdatedAt = DateTime.Now;
                needsUpdate = true;
            }
        }

        if (needsUpdate)
        {
            await _db.SaveChangesAsync();
        }
    }
}

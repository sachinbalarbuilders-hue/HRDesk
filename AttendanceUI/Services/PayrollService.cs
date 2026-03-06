using System;
using System.Linq;
using System.Threading.Tasks;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Services;

public class PayrollService
{
    private readonly BiometricAttendanceDbContext _db;
    private readonly LoanService _loanService;

    public PayrollService(BiometricAttendanceDbContext db, LoanService loanService)
    {
        _db = db;
        _loanService = loanService;
    }

    /// <summary>
    /// Get attendance summary for an employee for a specific month
    /// </summary>
    public async Task<AttendanceSummary> GetAttendanceSummaryAsync(int employeeId, string month)
    {
        var year = int.Parse(month.Substring(0, 4));
        var monthNum = int.Parse(month.Substring(5, 2));
        
        var totalDays = DateTime.DaysInMonth(year, monthNum);
        
        var attendanceRecords = await _db.DailyAttendance
            .Where(a => a.EmployeeId == employeeId &&
                       a.RecordDate.Year == year &&
                       a.RecordDate.Month == monthNum)
            .ToListAsync();

        decimal presentDays = 0;
        decimal absentDays = 0;
        decimal paidLeaves = 0;
        decimal unpaidLeaves = 0;
        decimal halfDays = 0;
        decimal weekoffs = 0;
        decimal holidays = 0;
        var leaveCounts = new System.Collections.Generic.Dictionary<string, decimal>();
        var lopBreakdown = new System.Collections.Generic.Dictionary<DateOnly, decimal>();

        void AddLeaveCount(string code, decimal amount)
        {
            if (!leaveCounts.ContainsKey(code)) leaveCounts[code] = 0;
            leaveCounts[code] += amount;
        }

        void AddLop(DateOnly date, decimal amount)
        {
            if (!lopBreakdown.ContainsKey(date)) lopBreakdown[date] = 0;
            lopBreakdown[date] += amount;
        }

        foreach (var record in attendanceRecords)
        {
            var status = record.Status?.ToUpper().Trim() ?? "";
            
            if (status == "P" || status == "PRESENT" || status == "W/OP")
            {
                presentDays += 1.0m;
            }
            else if (status == "A" || status == "ABSENT")
            {
                absentDays += 1.0m;
                AddLop(record.RecordDate, 1.0m);
            }
            else if (status == "HF" || status == "HALF DAY")
            {
                halfDays += 1.0m;
                presentDays += 0.5m;
                absentDays += 0.5m;
                AddLop(record.RecordDate, 0.5m);
            }
            else if (status.EndsWith("HF") && status.Length > 2)
            {
                // WHF, PHF, SHF, COHF etc.
                
                // Specific handle for WHF (Worked Half on Weekoff)
                if (status == "WHF")
                {
                    presentDays += 0.5m; // Worked half
                    weekoffs += 0.5m;    // Weekoff half
                    halfDays += 1.0m;    // Record that a half-day occurred
                    continue;            // Skip the rest of the generic HF logic
                }
                
                // For half-day leave records, rely solely on WorkMinutes to determine if work was done.
                // InTime may still be present for audit purposes (e.g. early-exit penalty cases)
                // but should not override a WorkMinutes=0 signal.
                bool isWorkDone = record.WorkMinutes > 0;
                
                if (isWorkDone)
                {
                    presentDays += 0.5m; // Worked half
                }
                
                // Categorize the leave half
                if (status.StartsWith("CO") || status == "CHF")
                {
                    weekoffs += 0.5m; // Comp-Off is a weekoff adjustment
                }
                else
                {
                    // Check if it's a paid leave type
                    var leaveTypes = await _db.LeaveTypes.ToListAsync();
                    var matchingType = leaveTypes.FirstOrDefault(lt => status.Contains(lt.Code.ToUpper()));
                    
                    if (matchingType != null && matchingType.IsPaid)
                    {
                        paidLeaves += 0.5m; // Unworked leave portion
                        AddLeaveCount(matchingType.Code, 0.5m);
                    }
                    else if (status.StartsWith("PL") || status.StartsWith("SL") || status == "PHF")
                    {
                        paidLeaves += 0.5m; // Default common codes to paid
                        AddLeaveCount("PHF", 0.5m); // Force PHF code for consistency
                    }
                    else
                    {
                        unpaidLeaves += 0.5m;
                        absentDays += 0.5m; // Always show unpaid halves as absentee time in reports
                        AddLop(record.RecordDate, 0.5m);
                    }
                }

                if (!isWorkDone)
                {
                    halfDays += 1.0m; // Partial pay day
                    absentDays += 0.5m; // The non-worked half is an absence
                    AddLop(record.RecordDate, 0.5m);
                }
            }
            else if (status == "WO" || status == "W/O" || status == "WEEKOFF" || status == "WEEK OFF")
            {
                weekoffs += 1.0m;
            }
            else if (status == "H" || status == "HOLIDAY")
            {
                holidays += 1.0m;
            }
            else if (status.Contains("LEAVE") || status.Length >= 2)
            {
                // Full Day Leave or special status
                bool isWorkDone = status.Contains("PRESENT") || record.WorkMinutes > 0;
                
                if (isWorkDone)
                {
                    presentDays += 1.0m;
                }
                else
                {
                    if (status.StartsWith("CO"))
                    {
                        weekoffs += 1.0m; // CO is a weekoff adjustment
                    }
                    else
                    {
                        var leaveTypes = await _db.LeaveTypes.ToListAsync(); 
                        var matchingType = leaveTypes.FirstOrDefault(lt => status.Contains(lt.Code.ToUpper()));
                        
                        if (matchingType != null && matchingType.IsPaid)
                        {
                            paidLeaves += 1.0m;
                            AddLeaveCount(matchingType.Code, 1.0m);
                        }
                        else if (status == "LEAVE" || status.StartsWith("PL") || status.StartsWith("SL"))
                        {
                             paidLeaves += 1.0m;
                             AddLeaveCount(status.Split(' ')[0], 1.0m);
                        }
                        else
                        {
                            unpaidLeaves += 1.0m;
                            absentDays += 1.0m;
                            AddLop(record.RecordDate, 1.0m);
                        }
                    }
                }
            }
            else if (!string.IsNullOrEmpty(status))
            {
                presentDays += 1.0m;
            }
        }

        return new AttendanceSummary
        {
            TotalDays = totalDays,
            PresentDays = presentDays,
            AbsentDays = absentDays,
            PaidLeaves = paidLeaves, 
            UnpaidLeaves = unpaidLeaves,
            HalfDays = halfDays,
            Weekoffs = weekoffs,
            Holidays = holidays,
            LeaveTypeCounts = leaveCounts,
            LopDetails = lopBreakdown
                .OrderBy(kvp => kvp.Key)
                .Select(kvp => $"{kvp.Key:dd-MMM}{(kvp.Value == 0.5m ? " (0.5)" : "")}")
                .ToList()
        };
    }

    /// <summary>
    /// Calculate gross salary for an employee
    /// </summary>
    public async Task<decimal> GetGrossSalaryAsync(int employeeId, string month)
    {
        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId &&
                       s.IsActive &&
                       s.SalaryComponent!.ComponentType == "Earning")
            .ToListAsync();

        return salaryStructure.Sum(s => s.Amount);
    }

    /// <summary>
    /// Process payroll for a single employee for a specific month
    /// </summary>
    public async Task<PayrollMaster> ProcessEmployeePayrollAsync(int employeeId, string month, 
        System.Collections.Generic.List<ManualAdjustment>? manualAdjustments = null)
    {
        // Check if payroll already exists
        var existing = await _db.PayrollMasters
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.Month == month);

        var attendance = await GetAttendanceSummaryAsync(employeeId, month);
        var grossSalary = await GetGrossSalaryAsync(employeeId, month);

        // Skip if no salary structure
        if (grossSalary == 0)
        {
            throw new InvalidOperationException("Employee has no salary structure defined");
        }

        // Get salary structure
        var salaryStructure = await _db.EmployeeSalaryStructures
            .Include(s => s.SalaryComponent)
            .Where(s => s.EmployeeId == employeeId && s.IsActive)
            .ToListAsync();

        // Calculate earnings
        decimal totalEarnings = 0;
        var earningDetails = new System.Collections.Generic.List<PayrollDetail>();

        // Filter earning components
        var earningComponents = salaryStructure
            .Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Earning")
            .ToList();

        // Calculate payable days once
        var payableDays = attendance.PresentDays + attendance.PaidLeaves + attendance.Weekoffs + attendance.Holidays;
        payableDays = Math.Min(payableDays, attendance.TotalDays);

        foreach (var component in earningComponents)
        {
            var netAmount = component.Amount; // Show full amount

            totalEarnings += netAmount;
            earningDetails.Add(new PayrollDetail
            {
                ComponentId = component.ComponentId,
                ComponentType = "Earning",
                ComponentName = component.SalaryComponent!.ComponentName,
                Amount = netAmount,
                Remarks = "Full earning component"
            });
        }

        // Add ad-hoc manual adjustments
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Allowance"))
            {
                totalEarnings += adj.Amount;
                earningDetails.Add(new PayrollDetail
                {
                    ComponentType = "Earning",
                    ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Allowance",
                    Amount = adj.Amount,
                    Remarks = "Manual adjustment"
                });
            }
        }

        // Calculate deductions
        decimal totalDeductions = 0;
        var deductionDetails = new System.Collections.Generic.List<PayrollDetail>();

        // 1. Loss of Pay (LOP) Deduction
        var lopDays = (decimal)attendance.TotalDays - payableDays;
        if (lopDays > 0)
        {
            var lopAmount = (grossSalary / attendance.TotalDays) * lopDays;
            totalDeductions += lopAmount;
            
            var lopRemark = $"Absent/LWP: {lopDays:0.0} days";
            if (attendance.LopDetails.Any())
            {
                lopRemark += $" ({string.Join(", ", attendance.LopDetails)})";
            }

            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "Loss of Pay",
                Amount = lopAmount,
                Remarks = lopRemark
            });
        }

        // 2. Fixed Deduction components from structure (PF, Tax etc.)
        var deductionComponents = salaryStructure
            .Where(s => s.SalaryComponent != null && s.SalaryComponent.ComponentType == "Deduction")
            .ToList();

        foreach (var component in deductionComponents)
        {
            totalDeductions += component.Amount;
            deductionDetails.Add(new PayrollDetail
            {
                ComponentId = component.ComponentId,
                ComponentType = "Deduction",
                ComponentName = component.SalaryComponent!.ComponentName,
                Amount = component.Amount,
                Remarks = "Fixed deduction"
            });
        }

        // 3. Loan installment deduction
        var loanDeduction = await _loanService.GetPendingInstallmentForMonthAsync(employeeId, month);
        if (loanDeduction > 0)
        {
            totalDeductions += loanDeduction;
            deductionDetails.Add(new PayrollDetail
            {
                ComponentType = "Deduction",
                ComponentName = "Loan Installment",
                Amount = loanDeduction,
                Remarks = "Monthly loan installment"
            });
        }

        // 4. Ad-hoc deductions (Manual adjustments)
        if (manualAdjustments != null)
        {
            foreach (var adj in manualAdjustments.Where(a => a.Type == "Deduction"))
            {
                deductionDetails.Add(new PayrollDetail
                {
                    ComponentType = "Deduction",
                    ComponentName = !string.IsNullOrWhiteSpace(adj.Name) ? adj.Name : "Ad-hoc Deduction",
                    Amount = adj.Amount,
                    Remarks = "Manual adjustment"
                });
            }
        }

        // Finalize totals from details to ensure absolute sync
        totalEarnings = earningDetails.Sum(e => e.Amount);
        totalDeductions = deductionDetails.Sum(d => d.Amount);

        // Create or update payroll master
        var payroll = existing ?? new PayrollMaster
        {
            EmployeeId = employeeId,
            Month = month
        };

        payroll.TotalDays = attendance.TotalDays;
        payroll.PresentDays = attendance.PresentDays;
        payroll.AbsentDays = attendance.AbsentDays;
        payroll.PaidLeaves = attendance.PaidLeaves;
        payroll.UnpaidLeaves = attendance.UnpaidLeaves;
        payroll.HalfDays = attendance.HalfDays;
        payroll.Weekoffs = attendance.Weekoffs;
        payroll.Holidays = attendance.Holidays;
        payroll.PayableDays = payableDays;
        payroll.GrossSalary = grossSalary;
        payroll.TotalEarnings = totalEarnings;
        payroll.TotalDeductions = totalDeductions;
        payroll.NetSalary = totalEarnings - totalDeductions;
        payroll.Status = "Processed";
        payroll.ProcessedDate = DateTime.Now;
        
        // Serialize Leave Breakdown
        if (attendance.LeaveTypeCounts.Any())
        {
            payroll.LeaveBreakdown = System.Text.Json.JsonSerializer.Serialize(attendance.LeaveTypeCounts);
        }
        else
        {
            payroll.LeaveBreakdown = null;
        }

        if (existing == null)
        {
            _db.PayrollMasters.Add(payroll);
        }

        await _db.SaveChangesAsync();

        // Clear existing details if updating
        if (existing != null)
        {
            var existingDetails = await _db.PayrollDetails
                .Where(d => d.PayrollId == payroll.Id)
                .ToListAsync();
            _db.PayrollDetails.RemoveRange(existingDetails);
        }

        // Add payroll details
        foreach (var detail in earningDetails.Concat(deductionDetails))
        {
            detail.PayrollId = payroll.Id;
            _db.PayrollDetails.Add(detail);
        }

        await _db.SaveChangesAsync();

        // Process loan installment payment
        if (loanDeduction > 0)
        {
            // Re-fetch to ensure we have the latest status (might have changed during process)
            var relevantLoans = await _db.EmployeeLoans
                .Where(l => l.EmployeeId == employeeId && (l.Status == "Active" || l.Status == "Completed" || l.Status == "Approved"))
                .ToListAsync();

            foreach (var loan in relevantLoans)
            {
                await _loanService.ProcessInstallmentPaymentAsync(loan.Id, month, payroll.Id);
            }
        }

        return payroll;
    }

    /// <summary>
    /// Process payroll for all employees for a specific month
    /// </summary>
    public async Task<int> ProcessMonthlyPayrollAsync(string month)
    {
        var employees = await _db.Employees
            .Where(e => e.Status == "Active")
            .ToListAsync();

        int processedCount = 0;

        foreach (var employee in employees)
        {
            try
            {
                await ProcessEmployeePayrollAsync(employee.EmployeeId, month);
                processedCount++;
            }
            catch (Exception)
            {
                // Skip employees with errors and continue
                continue;
            }
        }

        return processedCount;
    }
}

public class AttendanceSummary
{
    public int TotalDays { get; set; }
    public decimal PresentDays { get; set; }
    public decimal AbsentDays { get; set; }
    public decimal PaidLeaves { get; set; }
    public decimal UnpaidLeaves { get; set; }
    public decimal HalfDays { get; set; }
    public decimal Weekoffs { get; set; }
    public decimal Holidays { get; set; }
    public System.Collections.Generic.Dictionary<string, decimal> LeaveTypeCounts { get; set; } = new();
    public System.Collections.Generic.List<string> LopDetails { get; set; } = new();
}

using System;
using System.ComponentModel.DataAnnotations;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Shifts;

public sealed class CreateModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public CreateModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public FormInput Input { get; set; } = new();

    public void OnGet()
    {
        Input.Status = "active";
        Input.LunchBreakStart = new TimeOnly(13, 0);
        Input.LunchBreakEnd = new TimeOnly(14, 0);
        Input.HalfTime = new TimeOnly(13, 0);
        Input.LateComingGraceMinutes = 30;
        Input.LateComingAllowedCountPerMonth = 3;
        Input.LateComingHalfDayOnExceed = true;
        Input.EarlyLeaveGraceMinutes = 0;
        Input.EarlyGoAllowedTime = new TimeOnly(18, 30);
        Input.EarlyGoFrequencyPerMonth = 1;
        
        var colors = new[] { "#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b", "#6f42c1", "#fd7e14", "#d63384", "#20c997", "#0dcaf0" };
        Input.ColorCode = colors[new Random().Next(colors.Length)];
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var code = Input.ShiftCode.Trim();
        var exists = await _db.Shifts.AnyAsync(s => s.ShiftCode == code);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Shift code already exists.");
            return Page();
        }

        var shift = new Shift
        {
            ShiftName = Input.ShiftName.Trim(),
            ShiftCode = code,
            StartTime = Input.StartTime!.Value,
            EndTime = Input.EndTime!.Value,
            LunchBreakStart = Input.LunchBreakStart,
            LunchBreakEnd = Input.LunchBreakEnd,
            HalfTime = Input.HalfTime!.Value,
            LateComingGraceMinutes = Input.LateComingGraceMinutes,
            LateComingAllowedCountPerMonth = Input.LateComingAllowedCountPerMonth,
            LateComingHalfDayOnExceed = Input.LateComingHalfDayOnExceed,
            EarlyLeaveGraceMinutes = Input.EarlyLeaveGraceMinutes,
            EarlyGoAllowedTime = Input.EarlyGoAllowedTime!.Value,
            EarlyGoFrequencyPerMonth = Input.EarlyGoFrequencyPerMonth,
            ColorCode = Input.ColorCode,
            Status = Input.Status
        };

        _db.Shifts.Add(shift);
        await _db.SaveChangesAsync();
        return RedirectToPage("./Index");
    }

    public sealed class FormInput
    {
        [Required]
        [StringLength(100)]
        [Display(Name = "Shift Name")]
        public string ShiftName { get; set; } = "";

        [Required]
        [StringLength(20)]
        [Display(Name = "Shift Code")]
        public string ShiftCode { get; set; } = "";

        [Required]
        [Display(Name = "Start Time")]
        public TimeOnly? StartTime { get; set; }

        [Required]
        [Display(Name = "End Time")]
        public TimeOnly? EndTime { get; set; }

        [Display(Name = "Lunch Break Start")]
        public TimeOnly? LunchBreakStart { get; set; }

        [Display(Name = "Lunch Break End")]
        public TimeOnly? LunchBreakEnd { get; set; }

        [Required]
        [Display(Name = "Half Time")]
        public TimeOnly? HalfTime { get; set; }

        [Display(Name = "Late Grace (Mins)")]
        public int LateComingGraceMinutes { get; set; }

        [Display(Name = "Max Late Allowed")]
        public int LateComingAllowedCountPerMonth { get; set; }

        [Display(Name = "Half Day on Exceed Late")]
        public bool LateComingHalfDayOnExceed { get; set; }

        [Display(Name = "Early Leave Grace (Mins)")]
        public int EarlyLeaveGraceMinutes { get; set; }

        [Required]
        [Display(Name = "Early Go Limit Time")]
        public TimeOnly? EarlyGoAllowedTime { get; set; }

        [Display(Name = "Max Early Go Allowed")]
        public int EarlyGoFrequencyPerMonth { get; set; }

        [Display(Name = "Status")]
        public string? Status { get; set; }

        [Display(Name = "Shift Color")]
        public string ColorCode { get; set; } = "#4e73df";
    }
}

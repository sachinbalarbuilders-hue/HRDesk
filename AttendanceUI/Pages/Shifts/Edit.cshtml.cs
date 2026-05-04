using System.ComponentModel.DataAnnotations;
using AttendanceUI.Data;
using AttendanceUI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace AttendanceUI.Pages.Shifts;

public sealed class EditModel : PageModel
{
    private readonly BiometricAttendanceDbContext _db;

    public EditModel(BiometricAttendanceDbContext db)
    {
        _db = db;
    }

    [BindProperty(SupportsGet = true)]
    public int Id { get; set; }

    [BindProperty]
    public FormInput Input { get; set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        var shift = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == Id);
        if (shift is null)
        {
            return NotFound();
        }

        Input = new FormInput
        {
            ShiftName = shift.ShiftName,
            ShiftCode = shift.ShiftCode,
            StartTime = shift.StartTime,
            EndTime = shift.EndTime,
            LunchBreakStart = shift.LunchBreakStart,
            LunchBreakEnd = shift.LunchBreakEnd,
            HalfTime = shift.HalfTime,
            LateComingGraceMinutes = shift.LateComingGraceMinutes ?? 30,
            LateComingAllowedCountPerMonth = shift.LateComingAllowedCountPerMonth ?? 3,
            LateComingHalfDayOnExceed = shift.LateComingHalfDayOnExceed ?? true,
            EarlyLeaveGraceMinutes = shift.EarlyLeaveGraceMinutes ?? 0,
            EarlyGoAllowedTime = shift.EarlyGoAllowedTime,
            EarlyGoFrequencyPerMonth = shift.EarlyGoFrequencyPerMonth ?? 1,
            ColorCode = shift.ColorCode ?? "#4e73df",
            Status = shift.Status,
        };

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var shift = await _db.Shifts.FirstOrDefaultAsync(s => s.Id == Id);
        if (shift is null)
        {
            return NotFound();
        }

        var code = Input.ShiftCode.Trim();
        var exists = await _db.Shifts.AnyAsync(s => s.Id != Id && s.ShiftCode == code);
        if (exists)
        {
            ModelState.AddModelError(string.Empty, "Shift code already exists.");
            return Page();
        }

        shift.ShiftName = Input.ShiftName.Trim();
        shift.ShiftCode = code;
        shift.StartTime = Input.StartTime!.Value;
        shift.EndTime = Input.EndTime!.Value;
        shift.LunchBreakStart = Input.LunchBreakStart;
        shift.LunchBreakEnd = Input.LunchBreakEnd;
        shift.HalfTime = Input.HalfTime!.Value;
        shift.LateComingGraceMinutes = Input.LateComingGraceMinutes;
        shift.LateComingAllowedCountPerMonth = Input.LateComingAllowedCountPerMonth;
        shift.LateComingHalfDayOnExceed = Input.LateComingHalfDayOnExceed;
        shift.EarlyLeaveGraceMinutes = Input.EarlyLeaveGraceMinutes;
        shift.EarlyGoAllowedTime = Input.EarlyGoAllowedTime!.Value;
        shift.EarlyGoFrequencyPerMonth = Input.EarlyGoFrequencyPerMonth;
        shift.ColorCode = Input.ColorCode;
        shift.Status = Input.Status;

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

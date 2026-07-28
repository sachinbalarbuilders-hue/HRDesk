using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Pages.Account;

public class LoginModel : PageModel
{
    private readonly BiometricAttendanceDbContext _context;

    public LoginModel(BiometricAttendanceDbContext context)
    {
        _context = context;
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? ReturnUrl { get; set; }

    // Pre-filled username from the remembered cookie
    public string? SavedUsername { get; set; }

    [TempData]
    public string? ErrorMessage { get; set; }

    public class InputModel
    {
        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;

        [Display(Name = "Remember me?")]
        public bool RememberMe { get; set; }
    }

    public void OnGet(string? returnUrl = null)
    {
        if (!string.IsNullOrEmpty(ErrorMessage))
        {
            ModelState.AddModelError(string.Empty, ErrorMessage);
        }

        returnUrl ??= Url.Content("~/");
        ReturnUrl = returnUrl;

        // Pre-fill username if we have a saved cookie
        SavedUsername = Request.Cookies["hrdesk_remembered_user"];
        if (!string.IsNullOrEmpty(SavedUsername))
        {
            Input.Username = SavedUsername;
            Input.RememberMe = true;
        }
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        returnUrl ??= Url.Content("~/");

        if (ModelState.IsValid)
        {
            // Simple check for demo: "admin" / "password"
            // In a real app, we would hash and check against DB
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == Input.Username && u.IsActive);

            if (user != null && VerifyPassword(Input.Password, user.PasswordHash))
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.GivenName, user.FullName ?? user.Username),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim("OrganizationId", user.OrganizationId.ToString())
                };

                var claimsIdentity = new ClaimsIdentity(
                    claims, CookieAuthenticationDefaults.AuthenticationScheme);

                var authProperties = new AuthenticationProperties
                {
                    IsPersistent = Input.RememberMe,
                    ExpiresUtc = Input.RememberMe 
                        ? DateTimeOffset.UtcNow.AddDays(30) 
                        : DateTimeOffset.UtcNow.AddHours(8)
                };

                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(claimsIdentity),
                    authProperties);

                // Save or clear the remembered username cookie
                if (Input.RememberMe)
                {
                    Response.Cookies.Append("hrdesk_remembered_user", Input.Username, new CookieOptions
                    {
                        Expires = DateTimeOffset.UtcNow.AddDays(90),
                        HttpOnly = true,
                        SameSite = SameSiteMode.Lax,
                        IsEssential = true
                    });
                }
                else
                {
                    Response.Cookies.Delete("hrdesk_remembered_user");
                }

                // Auto-upgrade plain-text password to BCrypt hash on first login
                if (!user.PasswordHash.StartsWith("$2a$") && !user.PasswordHash.StartsWith("$2b$") && !user.PasswordHash.StartsWith("$2y$"))
                {
                    user.PasswordHash = HashPassword(Input.Password);
                }

                user.LastLogin = DateTime.Now;
                await _context.SaveChangesAsync();

                return LocalRedirect(returnUrl);
            }

            ModelState.AddModelError(string.Empty, "Invalid login attempt.");
        }

        return Page();
    }

    private bool VerifyPassword(string password, string hash)
    {
        // If the stored hash looks like a BCrypt hash, use BCrypt to verify
        if (hash.StartsWith("$2a$") || hash.StartsWith("$2b$") || hash.StartsWith("$2y$"))
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }

        // Legacy plain-text check â€” only for migration on first login
        return password == hash;
    }

    private string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
    }
}

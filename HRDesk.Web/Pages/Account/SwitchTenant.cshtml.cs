using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace HRDesk.Web.Pages.Account
{
    [Authorize(Roles = "SuperAdmin")]
    public class SwitchTenantModel : PageModel
    {
        public IActionResult OnPost(int tenantId, string? returnUrl)
        {
            if (tenantId <= 0)
            {
                return BadRequest("Invalid Organization ID");
            }

            // Set cookie for active tenant
            var options = new CookieOptions
            {
                Expires = DateTime.UtcNow.AddDays(7),
                HttpOnly = true,
                Secure = true, // In production
                SameSite = SameSiteMode.Lax
            };

            Response.Cookies.Append("ActiveTenantId", tenantId.ToString(), options);

            return LocalRedirect(returnUrl ?? "~/");
        }
    }
}

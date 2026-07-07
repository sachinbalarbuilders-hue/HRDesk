using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using HRDesk.Web.Data;
using HRDesk.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HRDesk.Web.Pages.Organizations
{
    [Authorize(Roles = "SuperAdmin")]
    public class CreateModel : PageModel
    {
        private readonly BiometricAttendanceDbContext _context;
        private readonly HttpClient _httpClient;

        public CreateModel(BiometricAttendanceDbContext context)
        {
            _context = context;
            _httpClient = new HttpClient();
        }

        public List<SelectListItem> AvailableGroups { get; set; } = new List<SelectListItem>();

        public async Task<IActionResult> OnGetAsync()
        {
            // Try to fetch available groups from the Node service
            try
            {
                var response = await _httpClient.GetAsync("http://localhost:3000/groups");
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var data = JsonSerializer.Deserialize<JsonElement>(content);
                    if (data.TryGetProperty("groups", out var groupsArray))
                    {
                        foreach (var group in groupsArray.EnumerateArray())
                        {
                            var name = group.GetProperty("name").GetString();
                            var groupId = group.GetProperty("id").GetString();
                            if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(groupId))
                            {
                                AvailableGroups.Add(new SelectListItem { Text = name, Value = groupId });
                            }
                        }
                    }
                }
            }
            catch
            {
                // Ignore if Node service is unreachable
            }

            return Page();
        }

        [BindProperty]
        public Organization Organization { get; set; } = default!;

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            _context.Organizations.Add(Organization);
            await _context.SaveChangesAsync();

            return RedirectToPage("./Index");
        }
    }
}

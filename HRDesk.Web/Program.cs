using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.Cookies;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/hrdesk-.txt", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

// Add services to the container.
builder.Services.AddRazorPages(options =>
{
    // Secure the entire application by default (no login bypass)
    options.Conventions.AuthorizeFolder("/");
    
    // Only allow anonymous access to the Account folder (Login, AccessDenied)
    options.Conventions.AllowAnonymousToFolder("/Account");
}).AddRazorRuntimeCompilation();
builder.Services.AddControllersWithViews();
builder.Services.AddHealthChecks();

// Require authentication by default for all endpoints (Controllers & Pages)
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Add HttpContextAccessor and Tenant Provider
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<HRDesk.Web.Services.ICurrentTenantProvider, HRDesk.Web.Services.CurrentTenantProvider>();
builder.Services.AddScoped<HRDesk.Web.Services.IDeviceCommunicationService, HRDesk.Web.Services.DeviceCommunicationService>();
// Configure Authentication: Primary is Cookies for the Web Portal
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
})
.AddJwtBearer(options =>
{
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Key must be configured via environment variable.");

    var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HRDesk.Web";
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidIssuer = jwtIssuer
    };
});

builder.Services.AddDbContext<HRDesk.Web.Data.BiometricAttendanceDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("AttendanceDb");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Missing connection string 'AttendanceDb'.");
    }

    options.UseSqlServer(connectionString, sqlOptions => 
    {
        sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    });
});

builder.Services.AddScoped<HRDesk.Web.Services.IAttendanceProcessorService, HRDesk.Web.Services.AttendanceProcessorService>();
builder.Services.AddScoped<HRDesk.Web.Services.ISequenceService, HRDesk.Web.Services.SequenceService>();
builder.Services.AddScoped<HRDesk.Web.Services.ILoanService, HRDesk.Web.Services.LoanService>();
builder.Services.AddScoped<HRDesk.Web.Services.IAttendanceSummaryService, HRDesk.Web.Services.AttendanceSummaryService>(); // Shared counting logic
builder.Services.AddScoped<HRDesk.Web.Services.IPayrollService, HRDesk.Web.Services.PayrollService>();
builder.Services.AddScoped<HRDesk.Web.Services.ICompOffService, HRDesk.Web.Services.CompOffService>();
builder.Services.AddScoped<HRDesk.Web.Services.ILeaveAdjustmentService, HRDesk.Web.Services.LeaveAdjustmentService>();
builder.Services.AddSingleton<HRDesk.Web.Services.IReferenceDataCacheService, HRDesk.Web.Services.ReferenceDataCacheService>();
builder.Services.AddScoped<HRDesk.Web.Services.IImageGenerationService, HRDesk.Web.Services.ImageGenerationService>();
builder.Services.AddHostedService<HRDesk.Web.Services.CelebrationNotificationService>();
builder.Services.AddHttpClient<HRDesk.Web.Services.Attendance.ITeamOfficeSyncService, HRDesk.Web.Services.Attendance.TeamOfficeSyncService>();
builder.Services.AddHostedService<HRDesk.Web.Services.Attendance.TeamOfficeBackgroundSyncWorker>();

builder.Services.AddCors(options => {
    options.AddPolicy("LocalDevices", policy => {
        policy.WithOrigins("http://localhost", "http://192.168.1.*")
              .AllowAnyHeader()
              .WithMethods("GET", "POST");
    });
});

// Register WhatsApp Services
builder.Services.AddHttpClient<HRDesk.Web.Services.Notifications.IWhatsAppProvider, HRDesk.Web.Services.Notifications.NodeJsWhatsAppProvider>(client => 
{
    var url = builder.Configuration["WhatsApp:ServiceUrl"] ?? "http://localhost:3000";
    client.BaseAddress = new Uri(url);
});
builder.Services.AddScoped<HRDesk.Web.Services.Notifications.WhatsAppNotificationService>();

var app = builder.Build();

// Global Exception Middleware for API routes
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex) when (context.Request.Path.StartsWithSegments("/api"))
    {
        Log.Error(ex, "Unhandled API exception");
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "Internal server error." });
    }
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseSerilogRequestLogging();


app.UseRouting();

app.UseCors("LocalDevices");

app.UseAuthentication();
app.UseAuthorization();

// Seed default user
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HRDesk.Web.Data.BiometricAttendanceDbContext>();
    try { db.Database.Migrate(); } catch (Exception ex) { Console.WriteLine($"[Startup] Migration warning (non-fatal): {ex.Message}"); }

    // Auto-migration removed due to performance/crashing on startup.
    // Thumbnails will lazily fallback to disk until a dedicated migration job is run.

    
    try
    {
        if (!db.Organizations.Any())
        {
            db.Organizations.Add(new HRDesk.Web.Models.Organization
            {
                Id = 1,
                Name = "Default Organization",
                IsActive = true,
                CreatedAt = DateTime.Now
            });
            db.SaveChanges();
        }

        if (!db.Users.Any())
        {
            var randomPassword = Guid.NewGuid().ToString("N").Substring(0, 10);
            Console.WriteLine("\n========================================================");
            Console.WriteLine($"[SECURITY] Seeded default admin 'admin' with password: {randomPassword}");
            Console.WriteLine("========================================================\n");

            db.Users.Add(new HRDesk.Web.Models.User
            {
                Username = "admin",
                PasswordHash = randomPassword, // Seeded with secure random string
                FullName = "Administrator",
                Role = "SuperAdmin",
                IsActive = true,
                CreatedAt = DateTime.Now,
                OrganizationId = 1
            });
            db.SaveChanges();
        }

        // Seed PF Salary Component if not exists
        if (!db.SalaryComponents.Any(sc => sc.ComponentCode == "PF"))
        {
            db.SalaryComponents.Add(new HRDesk.Web.Models.SalaryComponent
            {
                ComponentName = "Provident Fund",
                ComponentCode = "PF",
                ComponentType = "Deduction",
                IsActive = true,
                DisplayOrder = 3,
                CreatedAt = DateTime.Now
            });
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Seeding warning (non-fatal): {ex.Message}");
    }

    // Push Device Configuration to Background Service
    try
    {
        var config = db.DeviceConfigurations.FirstOrDefault();
        if (config != null)
        {
            // We use Task.Run since this is an async call in a sync block, 
            // and we don't want to block the entire startup if the service is unreachable.
            _ = Task.Run(async () => 
            {
                using var innerScope = app.Services.CreateScope();
                var deviceService = innerScope.ServiceProvider.GetRequiredService<HRDesk.Web.Services.IDeviceCommunicationService>();
                
                var result = await deviceService.UpdateDeviceConfigAsync(
                    config.IpAddress, config.Port, config.MachineNumber, config.CommKey);
                if (!result.Success)
                {
                    Log.Warning("Background device config sync failed: {Error}", result.ErrorMessage);
                }
            });
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failed to push device configuration at startup");
    }
}

app.MapControllers();
app.MapRazorPages();
app.MapHealthChecks("/health");

app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

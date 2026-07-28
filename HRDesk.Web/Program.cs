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
builder.Services.AddControllers();

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
    var jwtKey = builder.Configuration["Jwt:Key"];
    if (string.IsNullOrEmpty(jwtKey) && !builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Jwt:Key must be configured in production environment.");
    jwtKey ??= "dev-secret-key-please-change";

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

    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));
});

builder.Services.AddScoped<HRDesk.Web.Services.AttendanceProcessorService>();
builder.Services.AddScoped<HRDesk.Web.Services.ISequenceService, HRDesk.Web.Services.SequenceService>();
builder.Services.AddScoped<HRDesk.Web.Services.LoanService>();
builder.Services.AddScoped<HRDesk.Web.Services.AttendanceSummaryService>(); // Shared counting logic
builder.Services.AddScoped<HRDesk.Web.Services.PayrollService>();
builder.Services.AddScoped<HRDesk.Web.Services.CompOffService>();
builder.Services.AddScoped<HRDesk.Web.Services.LeaveAdjustmentService>();
builder.Services.AddScoped<HRDesk.Web.Services.ImageGenerationService>();
builder.Services.AddHostedService<HRDesk.Web.Services.CelebrationNotificationService>();

// Register WhatsApp Services
builder.Services.AddHttpClient<HRDesk.Web.Services.Notifications.IWhatsAppProvider, HRDesk.Web.Services.Notifications.NodeJsWhatsAppProvider>(client => 
{
    // Point this to the local Node.js microservice
    client.BaseAddress = new Uri("http://localhost:3000");
});
builder.Services.AddScoped<HRDesk.Web.Services.Notifications.WhatsAppNotificationService>();

var app = builder.Build();

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

app.UseAuthentication();
app.UseAuthorization();

// Seed default user
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HRDesk.Web.Data.BiometricAttendanceDbContext>();
    try { db.Database.Migrate(); } catch (Exception ex) { Console.WriteLine($"[Startup] Migration warning (non-fatal): {ex.Message}"); }

    // Auto-migration removed due to performance/crashing on startup.
    // Thumbnails will lazily fallback to disk until a dedicated migration job is run.

    
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
                await HRDesk.Web.Services.WindowsServiceClient.UpdateDeviceConfigAsync(
                    config.IpAddress, config.Port, config.MachineNumber, config.CommKey);
            });
        }
    }
    catch (Exception)
    {
        // Fail silently on startup to avoid crashing the web app if the device service is down
    }
}

app.MapControllers();
app.MapRazorPages();

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

using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/hrdesk-.txt", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();
    builder.WebHost.UseUrls("http://0.0.0.0:5283");

builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});

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

// Require authentication by default for all endpoints (Controllers & Pages) supporting both Cookies and JWT Bearer
builder.Services.AddAuthorization(options =>
{
    var defaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder(
        CookieAuthenticationDefaults.AuthenticationScheme,
        Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();

    options.DefaultPolicy = defaultPolicy;
    options.FallbackPolicy = defaultPolicy;
});

// Swagger & OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "HRDesk REST API",
        Version = "v1",
        Description = "Unified REST API for HRDesk Web & Mobile"
    });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using Bearer scheme. Format: Bearer {token}",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Add HttpContextAccessor and Tenant Provider
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<HRDesk.Web.Services.ICurrentTenantProvider, HRDesk.Web.Services.CurrentTenantProvider>();
builder.Services.AddScoped<HRDesk.Web.Services.IDeviceCommunicationService, HRDesk.Web.Services.DeviceCommunicationService>();
// Configure Authentication: Primary is Cookies for the Web Portal + JWT for SPA & Mobile
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
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
})
.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
{
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? builder.Configuration["JwtSettings:Secret"]
        ?? "YourSuperSecretKeyWithAtLeast32CharactersForHMACSHA256";

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

builder.Services.AddAuthorization(options =>
{
    var defaultPolicy = new AuthorizationPolicyBuilder(
        CookieAuthenticationDefaults.AuthenticationScheme,
        JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();

    options.DefaultPolicy = defaultPolicy;
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
builder.Services.AddScoped<HRDesk.Web.Services.ILoanService, HRDesk.Web.Services.LoanService>();
builder.Services.AddScoped<HRDesk.Web.Services.IAttendanceSummaryService, HRDesk.Web.Services.AttendanceSummaryService>(); // Shared counting logic
builder.Services.AddScoped<HRDesk.Web.Services.IPayrollService, HRDesk.Web.Services.PayrollService>();
builder.Services.AddScoped<HRDesk.Web.Services.ICompOffService, HRDesk.Web.Services.CompOffService>();
builder.Services.AddScoped<HRDesk.Web.Services.ILeaveAdjustmentService, HRDesk.Web.Services.LeaveAdjustmentService>();
builder.Services.AddSingleton<HRDesk.Web.Services.IReferenceDataCacheService, HRDesk.Web.Services.ReferenceDataCacheService>();
builder.Services.AddSingleton<HRDesk.Web.Services.AI.IFaceRecognitionService, HRDesk.Web.Services.AI.FaceRecognitionService>();
builder.Services.AddScoped<HRDesk.Web.Services.IImageGenerationService, HRDesk.Web.Services.ImageGenerationService>();
builder.Services.AddHostedService<HRDesk.Web.Services.CelebrationNotificationService>();
builder.Services.AddHttpClient<HRDesk.Web.Services.Attendance.ITeamOfficeSyncService, HRDesk.Web.Services.Attendance.TeamOfficeSyncService>();
builder.Services.AddHostedService<HRDesk.Web.Services.Attendance.TeamOfficeBackgroundSyncWorker>();

builder.Services.AddScoped<HRDesk.Web.Services.Infrastructure.IPermissionService, HRDesk.Web.Services.Infrastructure.PermissionService>();
builder.Services.AddScoped<HRDesk.Web.Services.Infrastructure.IPlanEntitlementService, HRDesk.Web.Services.Infrastructure.PlanEntitlementService>();
builder.Services.AddScoped<HRDesk.Web.Services.Infrastructure.ITenantProvisioningService, HRDesk.Web.Services.Infrastructure.TenantProvisioningService>();
builder.Services.AddScoped<HRDesk.Web.Services.Infrastructure.IPaymentGatewayService, HRDesk.Web.Services.Infrastructure.RazorpayPaymentService>();
builder.Services.AddHostedService<HRDesk.Web.Services.Infrastructure.SubscriptionLifecycleBackgroundWorker>();

builder.Services.AddCors(options => {
    options.AddPolicy("AllowAll", policy => {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register WhatsApp Services
builder.Services.AddHttpClient<HRDesk.Web.Services.Notifications.IWhatsAppProvider, HRDesk.Web.Services.Notifications.NodeJsWhatsAppProvider>(client => 
{
    var url = builder.Configuration["WhatsApp:ServiceUrl"] ?? "http://localhost:3000";
    client.BaseAddress = new Uri(url);
});
builder.Services.AddScoped<HRDesk.Web.Services.Notifications.WhatsAppNotificationService>();
builder.Services.AddScoped<HRDesk.Web.Services.Notifications.IInAppNotificationService, HRDesk.Web.Services.Notifications.InAppNotificationService>();

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

// Swagger in Development & Production for testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "HRDesk REST API v1");
    c.RoutePrefix = "swagger";
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
app.UseCors("AllowAll");

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
        // 1. Create Companies table & columns if not exist
        try
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'companies')
                BEGIN
                    CREATE TABLE companies (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        legal_name NVARCHAR(150) NOT NULL,
                        trade_name NVARCHAR(100) NULL,
                        code NVARCHAR(20) NULL,
                        gstin NVARCHAR(30) NULL,
                        cin NVARCHAR(50) NULL,
                        pan NVARCHAR(20) NULL,
                        logo_url NVARCHAR(500) NULL,
                        website NVARCHAR(200) NULL,
                        email NVARCHAR(100) NULL,
                        phone NVARCHAR(30) NULL,
                        headquarters_address NVARCHAR(500) NULL,
                        is_active BIT NOT NULL DEFAULT 1,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
                    );
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Organizations') AND name = 'code')
                BEGIN
                    ALTER TABLE Organizations ADD code NVARCHAR(50) NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Organizations') AND name = 'radius_meters')
                BEGIN
                    ALTER TABLE Organizations ADD radius_meters FLOAT NULL DEFAULT 100;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Organizations') AND name = 'company_id')
                BEGIN
                    ALTER TABLE Organizations ADD company_id INT NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'branches')
                BEGIN
                    CREATE TABLE branches (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        organization_id INT NOT NULL,
                        name NVARCHAR(100) NOT NULL,
                        code NVARCHAR(50) NULL,
                        address NVARCHAR(500) NULL,
                        city NVARCHAR(100) NULL,
                        state NVARCHAR(100) NULL,
                        pincode NVARCHAR(20) NULL,
                        latitude FLOAT NULL,
                        longitude FLOAT NULL,
                        radius_meters FLOAT NULL DEFAULT 100,
                        whatsapp_group_id NVARCHAR(100) NULL,
                        is_active BIT NOT NULL DEFAULT 1,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
                    );
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('employees') AND name = 'branch_id')
                BEGIN
                    ALTER TABLE employees ADD branch_id INT NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'branch_id')
                BEGIN
                    ALTER TABLE users ADD branch_id INT NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'branch_id')
                BEGIN
                    ALTER TABLE roles ADD branch_id INT NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('branches') AND name = 'allowed_ips')
                BEGIN
                    ALTER TABLE branches ADD allowed_ips NVARCHAR(500) NULL;
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('branches') AND name = 'outside_attendance_policy')
                BEGIN
                    ALTER TABLE branches ADD outside_attendance_policy NVARCHAR(50) NOT NULL DEFAULT 'Block';
                END;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('attendance_logs') AND name = 'Latitude')
                BEGIN
                    ALTER TABLE attendance_logs ADD Latitude FLOAT NULL;
                    ALTER TABLE attendance_logs ADD Longitude FLOAT NULL;
                    ALTER TABLE attendance_logs ADD IpAddress NVARCHAR(50) NULL;
                    ALTER TABLE attendance_logs ADD PhotoUrl NVARCHAR(MAX) NULL;
                    ALTER TABLE attendance_logs ADD IsGeofenceValid BIT NULL;
                    ALTER TABLE attendance_logs ADD IsIpValid BIT NULL;
                END;
            ");

            if (!db.Companies.Any())
            {
                db.Companies.Add(new HRDesk.Web.Models.Company
                {
                    LegalName = "Sachin Balar Builders Pvt. Ltd.",
                    TradeName = "Hue Builders",
                    Code = "SBB",
                    Gstin = "24AAAAA0000A1Z5",
                    Cin = "U45200GJ2015PTC085123",
                    Pan = "AAAAA0000A",
                    Email = "contact@sachinbalar.com",
                    Phone = "+91 98765 43210",
                    HeadquartersAddress = "Surat, Gujarat, India",
                    IsActive = true,
                    CreatedAt = DateTime.Now
                });
                db.SaveChanges();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup] Company DB migration warning: {ex.Message}");
        }

        if (!db.Organizations.Any())
        {
            db.Organizations.Add(new HRDesk.Web.Models.Organization
            {
                Name = "Default Organization",
                IsActive = true,
                CreatedAt = DateTime.Now
            });
            db.SaveChanges();
        }

        var defaultOrg = db.Organizations.FirstOrDefault();
        if (defaultOrg != null)
        {
            // Seed System Roles
            var superAdminRole = db.Roles.FirstOrDefault(r => r.OrganizationId == defaultOrg.Id && r.Name == "Super Admin");
            if (superAdminRole == null)
            {
                superAdminRole = new HRDesk.Web.Models.Role
                {
                    Name = "Super Admin",
                    Description = "Full access across all system modules and organization settings.",
                    IsSystemRole = true,
                    OrganizationId = defaultOrg.Id,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                db.Roles.Add(superAdminRole);
                db.SaveChanges();

                // Grant all permissions with scope = All
                foreach (var perm in HRDesk.Web.Constants.AppPermissions.All)
                {
                    db.RolePermissions.Add(new HRDesk.Web.Models.RolePermission
                    {
                        RoleId = superAdminRole.Id,
                        PermissionKey = perm.Key,
                        Scope = HRDesk.Web.Constants.AppPermissions.Scopes.All,
                        OrganizationId = defaultOrg.Id
                    });
                }
                db.SaveChanges();
            }

            var managerRole = db.Roles.FirstOrDefault(r => r.OrganizationId == defaultOrg.Id && r.Name == "Department Manager");
            if (managerRole == null)
            {
                managerRole = new HRDesk.Web.Models.Role
                {
                    Name = "Department Manager",
                    Description = "Can manage rosters, approve leaves, and view attendance for direct reportees / department.",
                    IsSystemRole = true,
                    OrganizationId = defaultOrg.Id,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                db.Roles.Add(managerRole);
                db.SaveChanges();

                var managerPerms = new (string Key, string Scope)[]
                {
                    (HRDesk.Web.Constants.AppPermissions.Keys.EmployeesView, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.AttendanceView, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.AttendanceRoster, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.AttendanceRegularize, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.LeavesView, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.LeavesApprove, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.CompOffApprove, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting),
                    (HRDesk.Web.Constants.AppPermissions.Keys.PayrollView, HRDesk.Web.Constants.AppPermissions.Scopes.Reporting)
                };

                foreach (var (permKey, permScope) in managerPerms)
                {
                    db.RolePermissions.Add(new HRDesk.Web.Models.RolePermission
                    {
                        RoleId = managerRole.Id,
                        PermissionKey = permKey,
                        Scope = permScope,
                        OrganizationId = defaultOrg.Id
                    });
                }
                db.SaveChanges();
            }

            var employeeRole = db.Roles.FirstOrDefault(r => r.OrganizationId == defaultOrg.Id && r.Name == "Employee");
            if (employeeRole == null)
            {
                employeeRole = new HRDesk.Web.Models.Role
                {
                    Name = "Employee",
                    Description = "Standard staff account with access to personal records and attendance.",
                    IsSystemRole = true,
                    OrganizationId = defaultOrg.Id,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                db.Roles.Add(employeeRole);
                db.SaveChanges();

                var defaultEmpKeys = new[]
                {
                    HRDesk.Web.Constants.AppPermissions.Keys.EmployeesView,
                    HRDesk.Web.Constants.AppPermissions.Keys.AttendanceView,
                    HRDesk.Web.Constants.AppPermissions.Keys.AttendanceRegularize,
                    HRDesk.Web.Constants.AppPermissions.Keys.LeavesView,
                    HRDesk.Web.Constants.AppPermissions.Keys.LeavesApply,
                    HRDesk.Web.Constants.AppPermissions.Keys.PayrollView,
                    HRDesk.Web.Constants.AppPermissions.Keys.AttendanceRoster
                };

                foreach (var key in defaultEmpKeys)
                {
                    db.RolePermissions.Add(new HRDesk.Web.Models.RolePermission
                    {
                        RoleId = employeeRole.Id,
                        PermissionKey = key,
                        Scope = HRDesk.Web.Constants.AppPermissions.Scopes.Own,
                        OrganizationId = defaultOrg.Id
                    });
                }
                db.SaveChanges();
            }

            var adminUser = db.Users.FirstOrDefault(u => u.Username == "admin");
            if (adminUser == null)
            {
                db.Users.Add(new HRDesk.Web.Models.User
                {
                    Username = "admin",
                    PasswordHash = "password",
                    FullName = "Administrator",
                    Role = "SuperAdmin",
                    RoleId = superAdminRole.Id,
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    OrganizationId = defaultOrg.Id
                });
                db.SaveChanges();
                Console.WriteLine("\n[SEED] Created user: admin / password (Super Admin)\n");
            }
            else
            {
                adminUser.PasswordHash = "password";
                adminUser.Role = "SuperAdmin";
                adminUser.RoleId = superAdminRole.Id;
                db.SaveChanges();
            }
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

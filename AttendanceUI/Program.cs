using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizeFolder("/Attendance");
    options.Conventions.AuthorizeFolder("/AttendanceLogs");
    options.Conventions.AuthorizeFolder("/CompOff");
    options.Conventions.AuthorizeFolder("/Departments");
    options.Conventions.AuthorizeFolder("/Designations");
    options.Conventions.AuthorizeFolder("/Employees");
    options.Conventions.AuthorizeFolder("/Holidays");
    options.Conventions.AuthorizeFolder("/Leaves");
    options.Conventions.AuthorizeFolder("/Loans");
    options.Conventions.AuthorizeFolder("/Masters");
    options.Conventions.AuthorizeFolder("/Payroll");
    options.Conventions.AuthorizeFolder("/Regularizations");
    options.Conventions.AuthorizeFolder("/Reports");
    options.Conventions.AuthorizeFolder("/Shifts");
}).AddRazorRuntimeCompilation();
builder.Services.AddControllers();

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
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
})
.AddJwtBearer(options =>
{
    var jwtKey = builder.Configuration["Jwt:Key"] ?? "dev-secret-key-please-change";
    var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AttendanceUI";
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

builder.Services.AddDbContext<AttendanceUI.Data.BiometricAttendanceDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("AttendanceDb");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Missing connection string 'AttendanceDb'.");
    }

    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

builder.Services.AddScoped<AttendanceUI.Services.AttendanceProcessorService>();
builder.Services.AddScoped<AttendanceUI.Services.ISequenceService, AttendanceUI.Services.SequenceService>();
builder.Services.AddScoped<AttendanceUI.Services.LoanService>();
builder.Services.AddScoped<AttendanceUI.Services.PayrollService>();
builder.Services.AddScoped<AttendanceUI.Services.CompOffService>();
builder.Services.AddScoped<AttendanceUI.Services.LeaveAdjustmentService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseDeveloperExceptionPage();
if (!app.Environment.IsDevelopment())
{
    // app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// Seed default user
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AttendanceUI.Data.BiometricAttendanceDbContext>();
    db.Database.EnsureCreated(); // Ensure DB and tables exist

    // Create eligibility table if missing (Split to avoid atomicity issues with InnoDB on failure)
    try {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS `leave_type_eligibility` (
                `employee_id` INT NOT NULL,
                `leave_type_id` INT NOT NULL,
                PRIMARY KEY (`employee_id`, `leave_type_id`),
                INDEX `idx_lte_type` (`leave_type_id`)
            ) ENGINE=InnoDB;
        ");
        
        // Try to add constraints with unique names to avoid conflicts
        try { db.Database.ExecuteSqlRaw("ALTER TABLE `leave_type_eligibility` ADD CONSTRAINT `fk_lte_emp_rel_v1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE;"); } catch { }
        try { db.Database.ExecuteSqlRaw("ALTER TABLE `leave_type_eligibility` ADD CONSTRAINT `fk_lte_type_rel_v1` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE;"); } catch { }
    } catch { }
    
    if (!db.Users.Any())
    {
        db.Users.Add(new AttendanceUI.Models.User
        {
            Username = "admin",
            PasswordHash = "password", // In production, use hashed passwords
            FullName = "Administrator",
            Role = "Admin",
            IsActive = true,
            CreatedAt = DateTime.Now
        });
        db.SaveChanges();
    }

    // Seed PF Salary Component if not exists
    if (!db.SalaryComponents.Any(sc => sc.ComponentCode == "PF"))
    {
        db.SalaryComponents.Add(new AttendanceUI.Models.SalaryComponent
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
                await AttendanceUI.Services.WindowsServiceClient.UpdateDeviceConfigAsync(
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

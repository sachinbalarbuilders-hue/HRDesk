# HRDesk — Biometric Attendance & HRMS System

A comprehensive Human Resource Management System (HRMS) integrated with biometric hardware for automated attendance tracking, payroll processing, and leave management.

---

## 📂 Repository Structure

```
HRDesk/
├── AttendanceUI/                    # ASP.NET Core Razor Pages web app
├── Z903AttendanceService/           # Windows Service (biometric sync)
│   ├── Z903AttendanceService/       # Main service project (.NET Framework 4.8)
│   └── BackendExample/              # Example API controller for reference
├── biometric_attendance_schema.sql  # Full database schema
├── Update_AttendanceUI.bat          # One-click deploy for web app
├── Update_Z903Service.bat           # One-click build & deploy for service
└── README.md
```

---

## 🛠️ Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| MySQL | 8.x | Database |
| .NET SDK | 8.0+ | AttendanceUI web app |
| .NET Framework | 4.8 | Z903 Windows Service |
| Visual Studio Community | 2022+ | Building the Windows Service |
| IIS | 10 | Hosting AttendanceUI in production |

---

## 🗄️ Database Setup

1. Create the MySQL database:
   ```sql
   CREATE DATABASE biometric_attendance;
   ```

2. Import the schema:
   ```bash
   mysql -u root -p biometric_attendance < biometric_attendance_schema.sql
   ```

3. Update connection strings:
   - **Web app**: `AttendanceUI/appsettings.json`
   - **Service**: `Z903AttendanceService/Z903AttendanceService/App.config`

---

## 🌐 AttendanceUI (Web Application)

**Tech**: ASP.NET Core Razor Pages, Entity Framework Core, MySQL

### Features
- Employee management (profiles, departments, designations, shifts)
- Attendance tracking with regularization workflows & sandwich rule logic
- Leave management with Comp-Off expiry (90 days) & holiday calendars
- Payroll processing with loan installment deductions
- Multi-device biometric configuration & connectivity testing
- Reports: attendance logs, application tracking, late/early marks

### Run Locally (Development)
```bash
cd AttendanceUI
dotnet run
# Access at http://localhost:5000
```

### Deploy to IIS (Production)
Double-click **`Update_AttendanceUI.bat`** as Administrator. It will:
1. Publish the app in Release mode
2. Stop IIS & kill worker processes
3. Copy files to `C:\inetpub\AttendanceUI`
4. Restart IIS

---

## ⚙️ Z903AttendanceService (Windows Service)

**Tech**: C# .NET Framework 4.8, SBXPC Biometric SDK, MySQL

### Features
- **Multi-device sync**: Pulls punch records from ALL configured biometric machines every 5 minutes
- **Incremental sync**: Uses `device_sync_state` table to only fetch new records
- **Multi-device user operations**: SetUser, EnableUser, DeleteUser execute on ALL devices
- **IPC via Named Pipes**: Web app communicates with service for real-time operations
- **Retry logic**: Automatic connection retries with exponential backoff

### Service Paths
| Item | Path |
|------|------|
| Installed service | `C:\HRServices\Z903AttendanceService\` |
| Service logs | `C:\HRServices\Z903AttendanceService\Logs\service.log` |
| Source code | `HRDesk\Z903AttendanceService\` |

### Build & Deploy
Double-click **`Update_Z903Service.bat`** as Administrator. It will:
1. Build the project with MSBuild (Release | x64)
2. Stop the Windows Service
3. Copy output to `C:\HRServices\Z903AttendanceService\`
4. Restart the service

### Build Manually (Visual Studio)
1. Open `Z903AttendanceService\Z903AttendanceService.csproj` in Visual Studio Community
2. Set configuration to **Release | x64**
3. Build → Build Solution (Ctrl+Shift+B)
4. Output: `Z903AttendanceService\bin\x64\Release\`

### Install as Windows Service (First Time)
```cmd
sc create Z903AttendanceService binPath= "C:\HRServices\Z903AttendanceService\Z903AttendanceService.exe" start= auto
sc start Z903AttendanceService
```

---

## � Named Pipe Commands (IPC)

The web app communicates with the service via Named Pipes. Supported actions:

| Action | Description |
|--------|-------------|
| `SetName` | Register employee on all biometric devices |
| `EnableUser` | Enable/disable employee on all devices |
| `DeleteUser` | Remove employee from all devices |
| `UpdateConfig` | Update device connection settings |

---

## � Key Workflows

### Configuring Devices
1. Go to **Masters > Device Settings** in UI
2. Add biometric machines (IP, Port, Machine #, CommKey)
3. Service auto-syncs from all devices on next cycle

### Payroll Processing
1. Ensure all attendance is synced and regularizations are approved
2. Go to **Payroll > Process Payroll**
3. System calculates salary, accounts for leaves, deducts loan installments

### Leave Applications
1. Employees apply via UI
2. Admins approve/reject
3. Approved leaves auto-factor into attendance calculations

---

## � Troubleshooting

| Issue | Solution |
|-------|----------|
| Service not syncing | Check `C:\HRServices\Z903AttendanceService\Logs\service.log` |
| Build fails | Ensure NuGet packages restored, SDK DLLs in project folder |
| Device connection fails | Verify IP/Port in Device Settings, check firewall |
| Service won't start | Check Event Viewer > Windows Logs > Application |

---

## 📤 Git Workflow

```bash
git add .
git commit -m "your message"
git push origin main
```

**Repository**: https://github.com/sachinbalarbuilders-hue/HRDesk.git

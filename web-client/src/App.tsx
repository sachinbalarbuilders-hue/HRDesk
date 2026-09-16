import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { OrganizationProvider } from './context/CompanyContext';
import { TooltipProvider } from './components/ui/Tooltip';
import { AppLayout } from './components/layout/AppLayout';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { AccessRestricted } from './components/layout/AccessRestricted';

// Route-Level Lazy Loading (Code Splitting)
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Employees = lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const AddEmployee = lazy(() => import('./pages/employees/AddEmployee').then(m => ({ default: m.AddEmployee })));
const EditEmployee = lazy(() => import('./pages/employees/EditEmployee').then(m => ({ default: m.EditEmployee })));
const ViewEmployee = lazy(() => import('./pages/employees/ViewEmployee').then(m => ({ default: m.ViewEmployee })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Shifts = lazy(() => import('./pages/Shifts').then(m => ({ default: m.Shifts })));
const Regularizations = lazy(() => import('./pages/Regularizations').then(m => ({ default: m.Regularizations })));
const Leaves = lazy(() => import('./pages/Leaves').then(m => ({ default: m.Leaves })));
const CompOff = lazy(() => import('./pages/CompOff').then(m => ({ default: m.CompOff })));
const Holidays = lazy(() => import('./pages/Holidays').then(m => ({ default: m.Holidays })));
const Announcements = lazy(() => import('./pages/Announcements').then(m => ({ default: m.AnnouncementsPage })));
const Loans = lazy(() => import('./pages/Loans').then(m => ({ default: m.Loans })));
const ViewLoan = lazy(() => import('./pages/loans/ViewLoan').then(m => ({ default: m.ViewLoan })));
const Payroll = lazy(() => import('./pages/Payroll').then(m => ({ default: m.Payroll })));
const Recruitment = lazy(() => import('./pages/Recruitment').then(m => ({ default: m.Recruitment })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const VerifyEmployee = lazy(() => import('./pages/VerifyEmployee').then(m => ({ default: m.VerifyEmployee })));
const GuardScanner = lazy(() => import('./pages/GuardScanner').then(m => ({ default: m.GuardScanner })));
const OrganizationShell = lazy(() => import('./pages/settings/organization/OrganizationShell').then(m => ({ default: m.OrganizationShell })));
const OrgDetailsTab = lazy(() => import('./pages/settings/organization/OrgDetailsTab').then(m => ({ default: m.OrgDetailsTab })));
const OrgBranchesTab = lazy(() => import('./pages/settings/organization/OrgBranchesTab').then(m => ({ default: m.OrgBranchesTab })));
const OrgPolicyTab = lazy(() => import('./pages/settings/organization/OrgPolicyTab').then(m => ({ default: m.OrgPolicyTab })));
const BranchDetails = lazy(() => import('./pages/settings/BranchDetails').then(m => ({ default: m.BranchDetails })));
const BranchPermissions = lazy(() => import('./pages/settings/BranchPermissions').then(m => ({ default: m.BranchPermissions })));
const OrganizationsTab = lazy(() => import('./pages/settings/OrganizationsTab').then(m => ({ default: m.OrganizationsTab })));
const DepartmentsTab = lazy(() => import('./pages/settings/DepartmentsTab').then(m => ({ default: m.DepartmentsTab })));
const DesignationsTab = lazy(() => import('./pages/settings/DesignationsTab').then(m => ({ default: m.DesignationsTab })));
const LeaveTypesTab = lazy(() => import('./pages/settings/LeaveTypesTab').then(m => ({ default: m.LeaveTypesTab })));
const WorkShiftsTab = lazy(() => import('./pages/settings/WorkShiftsTab').then(m => ({ default: m.WorkShiftsTab })));
const SubscriptionTab = lazy(() => import('./pages/settings/SubscriptionTab').then(m => ({ default: m.SubscriptionTab })));
const AuditLogsTab = lazy(() => import('./pages/settings/AuditLogsTab').then(m => ({ default: m.AuditLogsTab })));
const ChangePasswordTab = lazy(() => import('./pages/settings/ChangePasswordTab').then(m => ({ default: m.ChangePasswordTab })));
const EmailSettingsTab = lazy(() => import('./pages/settings/EmailSettingsTab').then(m => ({ default: m.EmailSettingsTab })));
const StatutorySettingsTab = lazy(() => import('./pages/settings/StatutorySettingsTab').then(m => ({ default: m.StatutorySettingsTab })));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const EmployeeOnboarding = lazy(() => import('./pages/public/EmployeeOnboarding').then(m => ({ default: m.EmployeeOnboarding })));
const RegisterTenant = lazy(() => import('./pages/RegisterTenant').then(m => ({ default: m.RegisterTenant })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));

// ─── Full-screen animated auth loader ──────────────────────────────────────
const AuthLoader: React.FC = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 450);
    return () => clearInterval(iv);
  }, []);
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Spinner */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring – slow spin */}
        <svg
          width="64" height="64" viewBox="0 0 64 64"
          style={{ animation: 'spin 1.8s linear infinite' }}
        >
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke="var(--accent-light)"
            strokeWidth="4"
          />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="40 136"
          />
        </svg>
        {/* Inner dot */}
        <div
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: 'var(--accent)',
            boxShadow: '0 0 10px var(--accent)',
            animation: 'pulse-soft 1.8s ease-in-out infinite',
          }}
        />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
        >
          HR<span style={{ color: 'var(--accent)' }}>Desk</span>
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.03em',
            minWidth: '9ch',
            textAlign: 'center',
          }}
        >
          Authenticating{dots}
        </span>
      </div>

      {/* Progress shimmer bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ width: '120px', height: '3px', background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
    </div>
  );
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoader />;
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
  superAdminOnly?: boolean;
}> = ({
  children,
  permission,
  anyPermission,
  superAdminOnly,
}) => {
  const { user, isLoading, hasPermission, isAdmin } = useAuth();

  if (isLoading) return <AuthLoader />;

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (superAdminOnly && !user.isPlatformUser) {
    // Stealth Cloaking: Do not confirm the route exists to unauthorized users
    return <Navigate to="/" replace />;
  }

  if (permission && !isAdmin && !hasPermission(permission)) {
    return <AccessRestricted />;
  }

  if (anyPermission && anyPermission.length > 0 && !isAdmin) {
    const hasAny = anyPermission.some((p) => hasPermission(p));
    if (!hasAny) {
      return <AccessRestricted />;
    }
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OrganizationProvider>
          <ToastProvider>
            <TooltipProvider>
              <BrowserRouter>
            <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/auth/sign-in" element={<Login />} />
                <Route path="/login" element={<Navigate to="/auth/sign-in" replace />} />
                <Route path="/register" element={<RegisterTenant />} />
                <Route path="/verify/:id" element={<VerifyEmployee />} />
                <Route path="/onboarding/:token" element={<EmployeeOnboarding />} />
                <Route
                  path="/ops_console"
                  element={
                    <ProtectedRoute superAdminOnly>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/ops-console" element={<Navigate to="/ops_console" replace />} />

                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route
                    path="/announcements"
                    element={
                      <ProtectedRoute anyPermission={['Announcements.View', 'Announcements.Manage']}>
                        <Announcements />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/employees"
                    element={
                      <ProtectedRoute permission="Employees.View">
                        <Employees />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="employees/add"
                    element={
                      <ProtectedRoute permission="Employees.Edit">
                        <AddEmployee />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="employees/:id"
                    element={
                      <ProtectedRoute permission="Employees.View">
                        <ViewEmployee />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="employees/:id/edit"
                    element={
                      <ProtectedRoute permission="Employees.Edit">
                        <EditEmployee />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="attendance"
                    element={
                      <ProtectedRoute permission="Attendance.View">
                        <Attendance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="shifts"
                    element={
                      <ProtectedRoute
                        anyPermission={[
                          'Shifts.Roster.View',
                          'Shifts.Roster.Assign',
                          'Shifts.Requests.View',
                          'Shifts.Requests.Apply',
                          'Shifts.Requests.Approve',
                          'Shifts.Requests.Delete',
                          'Shifts.View',
                          'Shifts.Manage',
                          'Attendance.Roster',
                        ]}
                      >
                        <Shifts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="regularizations"
                    element={
                      <ProtectedRoute>
                        <Regularizations />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/scanner"
                    element={
                      <ProtectedRoute>
                        <GuardScanner />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="leaves"
                    element={
                      <ProtectedRoute permission="Leaves.View">
                        <Leaves />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="compoff"
                    element={
                      <ProtectedRoute permission="CompOff.View">
                        <CompOff />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="holidays"
                    element={
                      <ProtectedRoute anyPermission={['Holidays.View', 'Holidays.Manage']}>
                        <Holidays />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="loans"
                    element={
                      <ProtectedRoute>
                        <Loans />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="loans/:id"
                    element={
                      <ProtectedRoute>
                        <ViewLoan />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="payroll"
                    element={
                      <ProtectedRoute>
                        <Payroll />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Payroll />} />
                    <Route path=":tab" element={<Payroll />} />
                  </Route>
                  <Route
                    path="recruitment"
                    element={
                      <ProtectedRoute>
                        <Recruitment />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="roles"
                    element={<Navigate to="/settings" replace />}
                  />
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute
                        anyPermission={[
                          'Masters.Organizations.View',
                          'Masters.Departments.View',
                          'Masters.Designations.View',
                          'Leaves.Types.View',
                          'Shifts.View',
                          'System.Settings.View',
                          'System.Roles.View',
                          'System.Logs.View',
                        ]}
                      >
                        <Settings />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="organizations" replace />} />
                    <Route
                      path="organizations"
                      element={
                        <ProtectedRoute permission="Masters.Organizations.View">
                          <OrganizationsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="departments"
                      element={
                        <ProtectedRoute permission="Masters.Departments.View">
                          <DepartmentsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="designations"
                      element={
                        <ProtectedRoute permission="Masters.Designations.View">
                          <DesignationsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="leave-types"
                      element={
                        <ProtectedRoute permission="Leaves.Types.View">
                          <LeaveTypesTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="leaves" element={<Navigate to="/settings/leave-types" replace />} />
                    <Route
                      path="shifts"
                      element={
                        <ProtectedRoute permission="Shifts.View">
                          <WorkShiftsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="subscription"
                      element={
                        <ProtectedRoute permission="System.Settings.View">
                          <SubscriptionTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="audit-logs"
                      element={
                        <ProtectedRoute permission="System.Logs.View">
                          <AuditLogsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="email"
                      element={
                        <ProtectedRoute permission="System.Settings.View">
                          <EmailSettingsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="statutory"
                      element={
                        <ProtectedRoute permission="System.Settings.View">
                          <StatutorySettingsTab />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="change-password" element={<ChangePasswordTab />} />
                  </Route>
                  <Route
                    path="settings/organizations/:id"
                    element={
                      <ProtectedRoute permission="Masters.Organizations.View">
                        <OrganizationShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<OrgDetailsTab />} />
                    <Route path="branches" element={<OrgBranchesTab />} />
                    <Route path="policy" element={<OrgPolicyTab />} />
                  </Route>
                  <Route
                    path="settings/organizations/:orgId/branches/:branchId"
                    element={
                      <ProtectedRoute permission="Masters.Organizations.View">
                        <BranchDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings/organizations/:orgId/branches/:branchId/permissions"
                    element={
                      <ProtectedRoute permission="System.Roles.Edit">
                        <BranchPermissions />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ToastProvider>
      </OrganizationProvider>
    </AuthProvider>
  </ThemeProvider>
  );
};
export default App;

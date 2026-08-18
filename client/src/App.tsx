import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { OrganizationProvider } from './context/CompanyContext';
import { AppLayout } from './components/layout/AppLayout';
import { PageSkeleton } from './components/ui/PageSkeleton';

// Route-Level Lazy Loading (Code Splitting)
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Employees = lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Shifts = lazy(() => import('./pages/Shifts').then(m => ({ default: m.Shifts })));
const Regularizations = lazy(() => import('./pages/Regularizations').then(m => ({ default: m.Regularizations })));
const Leaves = lazy(() => import('./pages/Leaves').then(m => ({ default: m.Leaves })));
const Holidays = lazy(() => import('./pages/Holidays').then(m => ({ default: m.Holidays })));
const Loans = lazy(() => import('./pages/Loans').then(m => ({ default: m.Loans })));
const Payroll = lazy(() => import('./pages/Payroll').then(m => ({ default: m.Payroll })));
const Recruitment = lazy(() => import('./pages/Recruitment').then(m => ({ default: m.Recruitment })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const VerifyEmployee = lazy(() => import('./pages/VerifyEmployee').then(m => ({ default: m.VerifyEmployee })));
const GuardScanner = lazy(() => import('./pages/GuardScanner').then(m => ({ default: m.GuardScanner })));

const ProtectedRoute: React.FC<{ children: React.ReactNode; permission?: string }> = ({
  children,
  permission,
}) => {
  const { user, isLoading, hasPermission, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--paper)] text-[var(--ink)] text-xs font-data">
        Authenticating muster roll...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !isAdmin && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OrganizationProvider>
          <ToastProvider>
            <BrowserRouter>
            <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/verify/:id" element={<VerifyEmployee />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route
                    path="employees"
                    element={
                      <ProtectedRoute permission="Employees.View">
                        <Employees />
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
                      <ProtectedRoute>
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
                    path="holidays"
                    element={
                      <ProtectedRoute>
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
                    path="payroll"
                    element={
                      <ProtectedRoute>
                        <Payroll />
                      </ProtectedRoute>
                    }
                  />
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
                    element={<Navigate to="/settings?tab=roles" replace />}
                  />
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </OrganizationProvider>
    </AuthProvider>
  </ThemeProvider>
  );
};
export default App;

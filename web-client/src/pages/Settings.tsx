import React, { Suspense } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { useAuth } from '../context/AuthContext';
import { Building2, FolderTree, Award, CalendarCheck, Layers, CreditCard, History, Mail, Lock } from 'lucide-react';

import { AccessRestricted } from '../components/layout/AccessRestricted';

interface SettingsTabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
}

// Standardized RBAC per settings category
const ALL_SETTINGS_TABS: SettingsTabDef[] = [
  { id: 'organizations', label: 'Organizations', icon: <Building2 size={14} />, path: '/settings/organizations', permission: 'Masters.Organizations.View' },
  { id: 'departments', label: 'Departments', icon: <FolderTree size={14} />, path: '/settings/departments', permission: 'Masters.Departments.View' },
  { id: 'designations', label: 'Designations', icon: <Award size={14} />, path: '/settings/designations', permission: 'Masters.Designations.View' },
  { id: 'leave-types', label: 'Leave Types', icon: <CalendarCheck size={14} />, path: '/settings/leave-types', permission: 'Leaves.Types.View' },
  { id: 'shifts', label: 'Work Shifts', icon: <Layers size={14} />, path: '/settings/shifts', permission: 'Shifts.View' },
  { id: 'subscription', label: 'Subscription & Plans', icon: <CreditCard size={14} />, path: '/settings/subscription', permission: 'System.Settings.View' },
  { id: 'audit-logs', label: 'Audit Logs', icon: <History size={14} />, path: '/settings/audit-logs', permission: 'System.Logs.View' },
  { id: 'email', label: 'Email', icon: <Mail size={14} />, path: '/settings/email', permission: 'System.Settings.View' },
  { id: 'change-password', label: 'Password', icon: <Lock size={14} />, path: '/settings/change-password', permission: 'System.Settings.View' },
];

export const Settings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();

  const visibleTabs = ALL_SETTINGS_TABS.filter((t) => {
    if (!t.permission) return true;
    return isAdmin || hasPermission(t.permission);
  });

  if (visibleTabs.length === 0) {
    return <AccessRestricted />;
  }

  const activeTab = visibleTabs.find((t) => location.pathname.startsWith(t.path))?.id || visibleTabs[0]?.id || 'organizations';

  const handleTabChange = (tabId: string) => {
    const tab = visibleTabs.find((t) => t.id === tabId);
    if (tab) navigate(tab.path);
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Organization masters and configuration" />
      <Tabs
        tabs={visibleTabs.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeTab={activeTab}
        onChange={handleTabChange}
      />
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </PageContainer>
  );
};

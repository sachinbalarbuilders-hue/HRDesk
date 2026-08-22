import React, { Suspense } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { Building2, FolderTree, Award, CalendarCheck, Layers, CreditCard, History } from 'lucide-react';

// Each settings tab is its own nested route (lazy-loaded, see App.tsx),
// so only the currently visited tab's JS/data is ever fetched.
const SETTINGS_TABS = [
  { id: 'organizations', label: 'Organizations', icon: <Building2 size={14} />, path: '/settings/organizations' },
  { id: 'subscription', label: 'Subscription & Plans', icon: <CreditCard size={14} />, path: '/settings/subscription' },
  { id: 'audit-logs', label: 'Audit Logs', icon: <History size={14} />, path: '/settings/audit-logs' },
  { id: 'departments', label: 'Departments', icon: <FolderTree size={14} />, path: '/settings/departments' },
  { id: 'designations', label: 'Designations', icon: <Award size={14} />, path: '/settings/designations' },
  { id: 'leaves', label: 'Leave Types', icon: <CalendarCheck size={14} />, path: '/settings/leaves' },
  { id: 'shifts', label: 'Work Shifts', icon: <Layers size={14} />, path: '/settings/shifts' },
];

export const Settings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = SETTINGS_TABS.find((t) => location.pathname.startsWith(t.path))?.id || 'organizations';

  const handleTabChange = (tabId: string) => {
    const tab = SETTINGS_TABS.find((t) => t.id === tabId);
    if (tab) navigate(tab.path);
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Organization masters and configuration" />
      <Tabs
        tabs={SETTINGS_TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeTab={activeTab}
        onChange={handleTabChange}
      />
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </PageContainer>
  );
};

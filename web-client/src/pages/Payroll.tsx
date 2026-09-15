import React, { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { PayrollRegister } from './payroll/PayrollRegister';
import { TaxDeclarationsTab } from './payroll/TaxDeclarationsTab';
import { EmployeeSalariesTab } from './settings/EmployeeSalariesTab';
import { PayGroupsTab } from './settings/PayGroupsTab';
import { SalaryTemplatesTab } from './settings/SalaryTemplatesTab';
import { SalaryComponentsTab } from './settings/SalaryComponentsTab';
import { IndianRupee, Users, Settings2, LayoutTemplate, Layers, Wrench, Calculator, Landmark } from 'lucide-react';

type PayrollView = 'register' | 'declarations' | 'components' | 'salary-templates' | 'pay-groups' | 'employee-salaries';

const VALID_TABS: PayrollView[] = ['register', 'declarations', 'components', 'salary-templates', 'pay-groups', 'employee-salaries'];

const CONFIG_TABS: { id: PayrollView; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'components',        label: '1. Salary Components', icon: <Layers size={14} />, description: 'Define earnings and deductions' },
  { id: 'salary-templates',  label: '2. Salary Templates',  icon: <LayoutTemplate size={14} />, description: 'Group components into packages' },
  { id: 'pay-groups',        label: '3. Pay Groups',        icon: <Settings2 size={14} />, description: 'Set payment frequencies' },
  { id: 'employee-salaries', label: '4. Assign Salaries',   icon: <Users size={14} />, description: 'Assign CTCs to employees' },
];

export const Payroll: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const view: PayrollView =
    tab && VALID_TABS.includes(tab as PayrollView) ? (tab as PayrollView) : 'register';

  const isConfigMode = view !== 'register' && view !== 'declarations';
  const canConfig = isAdmin || hasPermission('Payroll.ManageSalary');

  const setView = (v: PayrollView) => {
    navigate(v === 'register' ? '/payroll' : `/payroll/${v}`, { replace: true });
  };

  const handleMainModeChange = (mode: string) => {
    if (mode === 'operations') setView('register');
    else if (mode === 'declarations') setView('declarations');
    else if (mode === 'configuration') setView('components');
  };

  return (
    <PageContainer>
      <PageHeader
        title="Payroll"
        description="Process monthly salaries and manage compensation configurations"
      />

      {canConfig && (
        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'operations', label: 'Run Payroll', icon: <Calculator size={14} /> },
              { id: 'declarations', label: 'IT Declarations & TDS', icon: <Landmark size={14} /> },
              { id: 'configuration', label: 'Setup & Configuration', icon: <Wrench size={14} /> }
            ]}
            activeTab={view === 'declarations' ? 'declarations' : isConfigMode ? 'configuration' : 'operations'}
            onChange={handleMainModeChange}
          />
        </div>
      )}

      {view === 'register' && <PayrollRegister />}
      {view === 'declarations' && <TaxDeclarationsTab />}

      {isConfigMode && canConfig && (
        <div className="flex flex-col h-full gap-4">
          <div className="grid grid-cols-4 gap-2 border-b border-[var(--rule)] pb-4">
            {CONFIG_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                  view === t.id
                    ? 'border-[var(--gold-500)] bg-[var(--gold-50)] dark:bg-[var(--gold-950)] text-[var(--gold-700)] dark:text-[var(--gold-300)]'
                    : 'border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-muted)] hover:border-[var(--gold-300)]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-[var(--ink)]">
                  <div className={`p-1.5 rounded-md ${view === t.id ? 'bg-[var(--gold-100)] text-[var(--gold-700)] dark:bg-[var(--gold-900)]' : 'bg-[var(--paper-subtle)]'}`}>
                    {t.icon}
                  </div>
                  {t.label}
                </div>
                <p className="text-xs opacity-80 mt-1">{t.description}</p>
              </button>
            ))}
          </div>

          <div className="flex-1 mt-2">
            {view === 'components'        && <SalaryComponentsTab />}
            {view === 'salary-templates'  && <SalaryTemplatesTab />}
            {view === 'pay-groups'        && <PayGroupsTab />}
            {view === 'employee-salaries' && <EmployeeSalariesTab />}
          </div>
        </div>
      )}
    </PageContainer>
  );
};

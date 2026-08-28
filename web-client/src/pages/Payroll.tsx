import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { PayrollRegister } from './payroll/PayrollRegister';
import { EmployeeSalariesTab } from './settings/EmployeeSalariesTab';
import { PayGroupsTab } from './settings/PayGroupsTab';
import { SalaryTemplatesTab } from './settings/SalaryTemplatesTab';
import { SalaryComponentsTab } from './settings/SalaryComponentsTab';
import { IndianRupee, Users, Settings2, LayoutTemplate, Layers } from 'lucide-react';

type PayrollView = 'register' | 'employee-salaries' | 'pay-groups' | 'salary-templates' | 'components';

const TABS: { id: PayrollView; label: string; icon: React.ReactNode }[] = [
  { id: 'register',          label: 'Payroll Register',   icon: <IndianRupee size={13} /> },
  { id: 'employee-salaries', label: 'Employee Salaries',  icon: <Users size={13} /> },
  { id: 'pay-groups',        label: 'Pay Groups',         icon: <Settings2 size={13} /> },
  { id: 'salary-templates',  label: 'Salary Templates',   icon: <LayoutTemplate size={13} /> },
  { id: 'components',        label: 'Salary Components',  icon: <Layers size={13} /> },
];

export const Payroll: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const [view, setView] = useState<PayrollView>('register');

  const canConfig = isAdmin || hasPermission('Payroll.ManageSalary');

  return (
    <PageContainer>
      <PageHeader
        title="Payroll"
        description="Process monthly salaries, configure pay groups, and salary structures"
      />

      {canConfig && (
        <div className="flex items-center gap-1 border-b border-[var(--rule)] mb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-1.5 pb-2 px-4 text-xs font-semibold transition-colors cursor-pointer ${
                view === tab.id
                  ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      )}

      {view === 'register'          && <PayrollRegister />}
      {view === 'employee-salaries' && <EmployeeSalariesTab />}
      {view === 'pay-groups'        && <PayGroupsTab />}
      {view === 'salary-templates'  && <SalaryTemplatesTab />}
      {view === 'components'        && <SalaryComponentsTab />}
    </PageContainer>
  );
};

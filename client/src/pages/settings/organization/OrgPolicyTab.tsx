import React, { useState } from 'react';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Save } from 'lucide-react';
import { useOrgOutletContext } from './OrganizationShell';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

function endMonthFromStart(start: number) {
  return start === 1 ? 12 : start - 1;
}

function startMonthFromEnd(end: number) {
  return end === 12 ? 1 : end + 1;
}

function monthLabel(month: number) {
  return MONTHS.find((m) => m.value === month)?.label ?? '';
}

function lastDayOfMonth(month: number) {
  return new Date(2024, month, 0).getDate();
}

export const OrgPolicyTab: React.FC = () => {
  const { orgId, isNew, policyForm, setPolicyForm } = useOrgOutletContext();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || isNew) return;

    try {
      setSaving(true);
      await apiClient.put('/masters/company-policy', {
        organizationId: orgId,
        yearStartMonth: policyForm.yearStartMonth,
        yearEndMonth: policyForm.yearEndMonth,
        advanceNoticeDays: policyForm.advanceNoticeDays,
        maxConsecutiveLeaves: policyForm.maxConsecutiveLeaves,
        sandwichRuleEnabled: policyForm.sandwichRuleEnabled,
        defaultProbationDays: policyForm.defaultProbationDays,
      });
      showSuccess('Saved', 'Company policies saved.');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save company policies.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSavePolicy} className="space-y-4 max-w-3xl text-sm">
      <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
        <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Company Year</h4>
        <p className="text-[var(--ink-muted)] mb-4">
          Set the company year cycle used across this organization for rest, payroll, and other company-wide rules.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Year Start Month</label>
            <select
              value={policyForm.yearStartMonth}
              onChange={(e) => {
                const start = Number(e.target.value);
                setPolicyForm({ ...policyForm, yearStartMonth: start, yearEndMonth: endMonthFromStart(start) });
              }}
              className="register-input w-full text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Year End Month</label>
            <select
              value={policyForm.yearEndMonth}
              onChange={(e) => {
                const end = Number(e.target.value);
                setPolicyForm({ ...policyForm, yearEndMonth: end, yearStartMonth: startMonthFromEnd(end) });
              }}
              className="register-input w-full text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-[var(--ink-muted)] mt-3">
          Company year runs from <span className="font-medium text-[var(--ink)]">1 {monthLabel(policyForm.yearStartMonth)}</span>
          {' '}to{' '}
          <span className="font-medium text-[var(--ink)]">{lastDayOfMonth(policyForm.yearEndMonth)} {monthLabel(policyForm.yearEndMonth)}</span>.
        </p>
      </div>

      <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
        <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Leave Application Rules</h4>
        <p className="text-[var(--ink-muted)] mb-4">Configure global constraints for employee leave applications across this organization.</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-[var(--ink)] block">Advance Notice Required</span>
              <span className="text-xs text-[var(--ink-muted)] block">Minimum days in advance an employee must apply for leave.</span>
            </div>
            <input
              type="number"
              min={0}
              value={policyForm.advanceNoticeDays}
              onChange={(e) => setPolicyForm({ ...policyForm, advanceNoticeDays: Number(e.target.value) })}
              className="register-input w-24 text-center font-data"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-[var(--ink)] block">Max Consecutive Leaves</span>
              <span className="text-xs text-[var(--ink-muted)] block">Maximum number of days an employee can take continuously.</span>
            </div>
            <input
              type="number"
              min={1}
              value={policyForm.maxConsecutiveLeaves}
              onChange={(e) => setPolicyForm({ ...policyForm, maxConsecutiveLeaves: Number(e.target.value) })}
              className="register-input w-24 text-center font-data"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
        <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Sandwich Leave Rule</h4>
        <p className="text-[var(--ink-muted)] mb-4">
          When enabled, if an employee takes leave on both sides of a weekoff (e.g., Friday &amp; Monday),
          the weekoff days in between are automatically counted as leave instead of regular days off.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={policyForm.sandwichRuleEnabled}
            onChange={(e) => setPolicyForm({ ...policyForm, sandwichRuleEnabled: e.target.checked })}
            className="rounded border-[var(--rule)] w-4 h-4"
          />
          <span className="font-medium text-[var(--ink)]">Enforce Sandwich Leave Rule</span>
        </label>
      </div>

      <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
        <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Probation & Confirmation</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-[var(--ink)] block">Default Probation Period (Days)</span>
              <span className="text-xs text-[var(--ink-muted)] block">Standard probation length for new hires.</span>
            </div>
            <input
              type="number"
              min={0}
              value={policyForm.defaultProbationDays}
              onChange={(e) => setPolicyForm({ ...policyForm, defaultProbationDays: Number(e.target.value) })}
              className="register-input w-24 text-center font-data"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary py-2 px-6 flex items-center gap-2">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Policies'}
        </button>
      </div>
    </form>
  );
};

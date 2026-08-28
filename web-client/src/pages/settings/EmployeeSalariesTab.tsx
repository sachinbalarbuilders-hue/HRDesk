import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  Search, Check, UserX, ExternalLink,
} from 'lucide-react';

interface EmpRow {
  employeeId: number;
  publicId: string;
  employeeName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  payGroupId?: number;
  payGroupName?: string;
  payGroupBasis?: string;
  annualCTC?: number;
  monthlyCTC?: number;
  templateId?: number;
  templateName?: string;
  ctcEffectiveFrom?: string;
}

interface PayGroup { id: number; name: string; salaryBasis: string; isActive: boolean; templateId?: number; }

const BASIS_LABELS: Record<string, string> = {
  CalendarDays: 'Calendar Days', Fixed26: 'Fixed 26', Fixed30: 'Fixed 30',
  ActualWorkingDays: 'Actual Working Days', PerDay: 'Per Day',
};

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const EmployeeSalariesTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Bulk pay group assign bar
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, pgRes] = await Promise.all([
        apiClient.get('/employees/salary-overview'),
        apiClient.get('/pay-groups'),
      ]);
      setRows(empRes.data || []);
      setPayGroups((pgRes.data || []).filter((g: any) => g.isActive));
    } catch {
      showError('Failed to load salary overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      (r.employeeCode?.toLowerCase().includes(search.toLowerCase()));
    const matchGroup = !filterGroup
      ? true
      : filterGroup === '0'
        ? !r.payGroupId
        : r.payGroupId?.toString() === filterGroup;
    return matchSearch && matchGroup;
  });

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.employeeId));
  const toggleAll = () => {
    if (allSelected) setSelected(s => { const n = new Set(s); filtered.forEach(r => n.delete(r.employeeId)); return n; });
    else setSelected(s => { const n = new Set(s); filtered.forEach(r => n.add(r.employeeId)); return n; });
  };
  const toggleOne = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Bulk assign pay group ──────────────────────────────────────────────────
  const handleBulkAssign = async () => {
    if (!bulkGroupId || selected.size === 0) return;
    try {
      setBulkSaving(true);
      await apiClient.post(`/pay-groups/${bulkGroupId}/assign`, { employeeIds: Array.from(selected) });
      showSuccess(`${selected.size} employee(s) assigned to pay group`);
      setSelected(new Set());
      setBulkGroupId('');
      fetchAll();
    } catch { showError('Failed to assign pay group'); }
    finally { setBulkSaving(false); }
  };

  const handleBulkUnassign = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} employee(s) from their pay group?`)) return;
    try {
      setBulkSaving(true);
      await apiClient.post('/pay-groups/unassign', { employeeIds: Array.from(selected) });
      showSuccess(`${selected.size} employee(s) unassigned`);
      setSelected(new Set());
      fetchAll();
    } catch { showError('Failed to unassign'); }
    finally { setBulkSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[var(--ink)] font-ui">Employee Salaries</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Assign pay groups and CTC to employees in bulk. Select employees and use the action bar below.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="register-input w-full pl-8 text-sm"
          />
        </div>
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="register-input text-sm"
        >
          <option value="">All Pay Groups</option>
          <option value="0">⚠ Not Assigned</option>
          {payGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <span className="text-xs text-[var(--ink-muted)]">{filtered.length} employees</span>
      </div>

      {/* Bulk action bar — appears when rows are selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[var(--accent-light)] border border-[var(--accent)] rounded-[6px] flex-wrap">
          <span className="text-xs font-semibold text-[var(--accent)]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={bulkGroupId}
              onChange={e => setBulkGroupId(e.target.value)}
              className="register-input text-xs flex-1 min-w-40"
            >
              <option value="">— Assign to pay group —</option>
              {payGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkGroupId || bulkSaving}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Check size={12} /> {bulkSaving ? 'Saving...' : 'Assign'}
            </button>
            <button
              onClick={handleBulkUnassign}
              disabled={bulkSaving}
              className="btn-outline text-xs flex items-center gap-1 text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger-light)]"
            >
              <UserX size={12} /> Remove from Group
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="h-32 flex items-center justify-center text-[var(--ink-muted)] text-sm">Loading...</div>
      ) : (
        <div className="rounded-[4px] border border-[var(--rule)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--rule)]">
              <tr>
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Employee</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Department</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Pay Group</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Annual CTC</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Monthly</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Template</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--ink-muted)] text-sm">
                    No employees found.
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.employeeId} className={`bg-[var(--paper)] hover:bg-[var(--surface-sunken)] transition-colors ${selected.has(row.employeeId) ? 'bg-[var(--accent-light)]' : ''}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(row.employeeId)} onChange={() => toggleOne(row.employeeId)} className="rounded" />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-[var(--ink)] text-xs">{row.employeeName}</p>
                    {row.employeeCode && <p className="text-[10px] font-mono text-[var(--ink-muted)]">{row.employeeCode}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--ink-muted)]">
                    {row.department ?? '—'}
                    {row.designation && <p className="text-[10px]">{row.designation}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.payGroupName ? (
                      <span className="text-xs font-medium text-[var(--ink)]">
                        {row.payGroupName}
                        {row.payGroupBasis && <span className="text-[10px] text-[var(--ink-muted)] block">{BASIS_LABELS[row.payGroupBasis] ?? row.payGroupBasis}</span>}
                      </span>
                    ) : (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--warning-light)] text-[var(--warning)] font-semibold">Not assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.annualCTC != null ? (
                      <span className="text-xs font-semibold text-[var(--ink)] font-mono">₹{fmt(row.annualCTC)}</span>
                    ) : (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-[3px] bg-[var(--warning-light)] text-[var(--warning)] font-semibold">Not set</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-[var(--ink-muted)]">
                    {row.monthlyCTC != null ? `₹${fmt(row.monthlyCTC)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--ink-muted)]">
                    {row.templateName ?? '—'}
                    {row.ctcEffectiveFrom && <p className="text-[10px]">from {row.ctcEffectiveFrom}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      to={`/employees/${row.publicId}?tab=payroll`}
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 ml-auto font-medium w-fit"
                      title="Open employee payroll tab"
                    >
                      <ExternalLink size={11} />
                      {row.annualCTC != null ? 'Revise' : 'Set CTC'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { exportToCSV } from '../../utils/csvHelper';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { Check, UserX, ExternalLink } from 'lucide-react';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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

  const paginatedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

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

  const handleExportCSV = () => {
    if (!filtered.length) { showError('Export Empty', 'No employee records to export.'); return; }
    exportToCSV('Employee_Salaries_Overview', filtered.map(r => ({
      'Employee Code': r.employeeCode || '',
      'Employee Name': r.employeeName,
      Department: r.department || '',
      Designation: r.designation || '',
      'Pay Group': r.payGroupName || 'Not Assigned',
      'Annual CTC (₹)': r.annualCTC || 0,
      'Monthly CTC (₹)': r.monthlyCTC || 0,
      'Salary Template': r.templateName || '',
      'Effective Date': r.ctcEffectiveFrom || '',
    })));
    showSuccess('Export Complete', 'Employee salaries exported to CSV.');
  };

  const columns: ColumnDef<EmpRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row: EmpRow) => (
        <div>
          <p className="font-semibold text-[var(--ink)] text-xs">{row.employeeName}</p>
          {row.employeeCode && <p className="text-[10px] font-mono text-[var(--ink-muted)]">{row.employeeCode}</p>}
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: EmpRow) => (
        <div>
          <span className="text-xs text-[var(--ink-muted)]">{row.department ?? '—'}</span>
          {row.designation && <p className="text-[10px] text-[var(--ink-muted)]">{row.designation}</p>}
        </div>
      ),
    },
    {
      key: 'payGroup',
      header: 'Pay Group',
      render: (row: EmpRow) =>
        row.payGroupName ? (
          <div>
            <span className="text-xs font-medium text-[var(--ink)]">{row.payGroupName}</span>
            {row.payGroupBasis && (
              <span className="text-[10px] text-[var(--ink-muted)] block">
                {BASIS_LABELS[row.payGroupBasis] ?? row.payGroupBasis}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
            Not assigned
          </span>
        ),
    },
    {
      key: 'annualCTC',
      header: 'Annual CTC',
      render: (row: EmpRow) =>
        row.annualCTC != null ? (
          <span className="text-xs font-semibold text-[var(--ink)] font-mono">₹{fmt(row.annualCTC)}</span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
            Not set
          </span>
        ),
    },
    {
      key: 'monthlyCTC',
      header: 'Monthly',
      render: (row: EmpRow) => (
        <span className="text-xs font-mono text-[var(--ink-muted)]">
          {row.monthlyCTC != null ? `₹${fmt(row.monthlyCTC)}` : '—'}
        </span>
      ),
    },
    {
      key: 'template',
      header: 'Template',
      render: (row: EmpRow) => (
        <div>
          <span className="text-xs text-[var(--ink-muted)]">{row.templateName ?? '—'}</span>
          {row.ctcEffectiveFrom && <p className="text-[10px] text-[var(--ink-muted)]">from {row.ctcEffectiveFrom}</p>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (row: EmpRow) => (
        <Link
          to={`/employees/${row.publicId}?tab=payroll`}
          className="text-xs text-[var(--gold-500)] hover:underline inline-flex items-center gap-1 font-medium"
          title="Open employee payroll tab"
        >
          <ExternalLink size={11} />
          {row.annualCTC != null ? 'Revise' : 'Set CTC'}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[var(--ink)] font-ui">Employee Salaries</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Assign pay groups and CTC structures to employees in bulk.
        </p>
      </div>

      {/* Unified DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search employees by name or code..."
        filters={[
          {
            id: 'payGroup',
            ariaLabel: 'Pay Group Filter',
            value: filterGroup,
            onChange: (v) => { setFilterGroup(v); setPage(1); },
            options: [
              { value: '', label: 'All Pay Groups' },
              { value: '0', label: '⚠ Not Assigned' },
              ...payGroups.map(g => ({ value: String(g.id), label: g.name })),
            ],
          },
        ]}
        onExport={handleExportCSV}
        exportLabel="Export CSV"
      />

      {/* Reusable DataTable with Selection and Built-in Bulk Action Bar */}
      <DataTable
        columns={columns}
        data={paginatedRows}
        loading={loading}
        showSrNo={false}
        selection={{
          selectedRowKeys: Array.from(selected),
          onChange: (keys) => setSelected(new Set(keys as number[])),
          renderBulkActions: () => (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bulkGroupId}
                onChange={e => setBulkGroupId(e.target.value)}
                className="px-2.5 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink)] min-w-40 cursor-pointer"
              >
                <option value="">— Assign to pay group —</option>
                {payGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkGroupId || bulkSaving}
                className="btn-primary text-xs flex items-center gap-1 cursor-pointer py-1 px-3"
              >
                <Check size={12} /> {bulkSaving ? 'Saving...' : 'Assign'}
              </button>
              <button
                onClick={handleBulkUnassign}
                disabled={bulkSaving}
                className="btn-outline text-xs flex items-center gap-1 text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger-light)] cursor-pointer py-1 px-3"
              >
                <UserX size={12} /> Remove from Group
              </button>
            </div>
          ),
        }}
        emptyMessage="No employees found matching the filter criteria."
        pagination={{
          page,
          pageSize,
          totalCount: filtered.length,
          totalPages: Math.ceil(filtered.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />
    </div>
  );
};

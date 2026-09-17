import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { exportToCSV } from '../../utils/csvHelper';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { Check, UserX, ExternalLink, Settings2, Plus, Pencil } from 'lucide-react';
import { BulkAssignSalaryModal } from './BulkAssignSalaryModal';
import { AssignCTCModal } from './AssignCTCModal';

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
  ctcEffectiveFrom?: string;
}

interface PayGroup { id: number; name: string; salaryBasis: string; isActive: boolean; }

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
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Single CTC assign modal
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [selectedSingleEmployee, setSelectedSingleEmployee] = useState<EmpRow | null>(null);

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
          <p className="font-semibold text-[var(--text-primary)] text-xs">{row.employeeName}</p>
          {row.employeeCode && <p className="text-xs font-normal  text-[var(--text-secondary)]">{row.employeeCode}</p>}
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: EmpRow) => (
        <div>
          <span className="text-xs text-[var(--text-secondary)]">{row.department ?? '—'}</span>
          {row.designation && <p className="text-xs font-normal text-[var(--text-secondary)]">{row.designation}</p>}
        </div>
      ),
    },
    {
      key: 'payGroup',
      header: 'Pay Group',
      render: (row: EmpRow) =>
        row.payGroupName ? (
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{row.payGroupName}</span>
            {row.payGroupBasis && (
              <span className="text-xs font-normal text-[var(--text-secondary)] block">
                {BASIS_LABELS[row.payGroupBasis] ?? row.payGroupBasis}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs font-normal px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
            Not assigned
          </span>
        ),
    },
    {
      key: 'annualCTC',
      header: 'Annual CTC',
      render: (row: EmpRow) =>
        row.annualCTC != null ? (
          <span className="text-xs font-semibold text-[var(--text-primary)] ">₹{fmt(row.annualCTC)}</span>
        ) : (
          <span className="text-xs font-normal px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
            Not set
          </span>
        ),
    },
    {
      key: 'monthlyCTC',
      header: 'Monthly',
      render: (row: EmpRow) => (
        <span className="text-xs  text-[var(--text-secondary)]">
          {row.monthlyCTC != null ? `₹${fmt(row.monthlyCTC)}` : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (row: EmpRow) => (
        <button
          type="button"
          onClick={() => {
            setSelectedSingleEmployee(row);
            setSingleModalOpen(true);
          }}
          className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
          title="Assign CTC for this employee"
        >
          {row.annualCTC != null ? <Pencil size={11} /> : <Plus size={11} />}
          {row.annualCTC != null ? 'Revise' : 'Set CTC'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)] ">Employee Salaries</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
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
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary text-xs flex items-center gap-1 cursor-pointer py-1 px-3"
              >
                <Settings2 size={12} /> Bulk Assign Configuration
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

      <BulkAssignSalaryModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        selectedEmployeeIds={Array.from(selected)} 
        onSuccess={() => {
          setSelected(new Set());
          fetchAll();
        }} 
      />

      {selectedSingleEmployee && (
        <AssignCTCModal
          isOpen={singleModalOpen}
          onClose={() => {
            setSingleModalOpen(false);
            setSelectedSingleEmployee(null);
          }}
          employeeId={selectedSingleEmployee.employeeId}
          employeeName={selectedSingleEmployee.employeeName}
          currentAnnualCTC={selectedSingleEmployee.annualCTC}
          currentPayGroupId={selectedSingleEmployee.payGroupId}
          currentPayGroupName={selectedSingleEmployee.payGroupName}
          onSuccess={() => {
            fetchAll();
          }}
        />
      )}
    </div>
  );
};

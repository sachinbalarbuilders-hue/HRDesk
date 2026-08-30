import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/CompanyContext';
import { exportToCSV } from '../../utils/csvHelper';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { ProcessPayrollModal } from './ProcessPayrollModal';
import { PayslipModal } from './PayslipModal';
import {
  ChevronLeft, ChevronRight, Check, CreditCard, FileText,
  Calculator, Download,
  DollarSign, TrendingDown, CheckCircle2, Users2,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getMonthDisplay = (yyyyMm: string) => {
  try {
    const [y, m] = yyyyMm.split('-').map(Number);
    return { month: MONTH_NAMES[m - 1], year: String(y) };
  } catch { return { month: yyyyMm, year: '' }; }
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  Draft:    { label: 'Draft',    cls: 'bg-[var(--warning-light)] text-[var(--warning)]' },
  Approved: { label: 'Approved', cls: 'bg-[var(--success-light)] text-[var(--success)]' },
  Paid:     { label: 'Paid',     cls: 'bg-[var(--info-light)] text-[var(--info)]' },
};

export const PayrollRegister: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [records, setRecords]       = useState<any[]>([]);
  const [metrics, setMetrics]       = useState<any>({});
  const [loading, setLoading]       = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [search, setSearch]         = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [departments, setDepartments]   = useState<any[]>([]);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip]   = useState<any | null>(null);
  const [loadingPayslip, setLoadingPayslip]     = useState(false);

  const canManage = isAdmin || hasPermission('Payroll.Process');
  const { month, year } = getMonthDisplay(selectedMonth);

  const fetchLookups = useCallback(async () => {
    try {
      const res = await apiClient.get('/employees/lookups', { params: { branchId: currentBranch?.id || undefined } });
      setDepartments(res.data?.departments || []);
    } catch { /* silent */ }
  }, [currentBranch?.id]);

  const archive = useArchiveActions({ endpoint: '/payroll', onDone: () => fetchRecords(), label: 'Payroll' });

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/payroll/records', {
        params: {
          month: selectedMonth,
          search: search || undefined,
          departmentId: departmentId ? parseInt(departmentId) : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          branchId: currentBranch?.id || undefined,
          archiveStatus: archiveFilter,
          page, pageSize,
        },
      });
      setRecords(res.data?.items || []);
      setMetrics(res.data?.metrics || {});
      setTotalCount(res.data?.totalCount || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err: any) {
      showError('Failed to load payroll', err.response?.data?.message || 'Network error');
    } finally { setLoading(false); }
  }, [selectedMonth, search, departmentId, statusFilter, currentBranch?.id, archiveFilter, page, pageSize]);

  useEffect(() => { fetchLookups(); }, [currentOrganization?.id, currentBranch?.id]);
  useEffect(() => { fetchRecords(); }, [selectedMonth, search, departmentId, statusFilter, currentOrganization?.id, currentBranch?.id, archiveFilter, page, pageSize, fetchRecords]);

  useEffect(() => {
    const reload = () => { setPage(1); fetchLookups(); fetchRecords(); };
    window.addEventListener('hrdesk:tenant_changed', reload);
    window.addEventListener('hrdesk:branch_changed', reload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', reload);
      window.removeEventListener('hrdesk:branch_changed', reload);
    };
  }, [selectedMonth, search, departmentId, statusFilter, currentOrganization?.id, currentBranch?.id]);

  const handlePrevMonth = () => {
    setPage(1);
    const [y, m] = selectedMonth.split('-').map(Number);
    setSelectedMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`);
  };
  const handleNextMonth = () => {
    setPage(1);
    const [y, m] = selectedMonth.split('-').map(Number);
    setSelectedMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`);
  };

  const handleViewPayslip = async (id: number) => {
    try {
      setLoadingPayslip(true);
      setPayslipModalOpen(true);
      const res = await apiClient.get(`/payroll/${id}/payslip`);
      setSelectedPayslip(res.data);
    } catch (err: any) {
      showError('Failed to load payslip', err.response?.data?.message || 'Server error');
      setPayslipModalOpen(false);
    } finally { setLoadingPayslip(false); }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await apiClient.post(`/payroll/${id}/status`, { status });
      showSuccess('Status Updated', `Changed to ${status}.`);
      fetchRecords();
    } catch (err: any) {
      showError('Update Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleBulkApprove = async (selectedKeys: (string | number)[], _: any, clearSelection?: () => void) => {
    if (!selectedKeys.length) return;
    try {
      await apiClient.post('/payroll/bulk-status', { ids: selectedKeys, status: 'Approved' });
      showSuccess('Bulk Approved', `Approved ${selectedKeys.length} records.`);
      clearSelection?.();
      fetchRecords();
    } catch (err: any) {
      showError('Bulk Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleExportCSV = () => {
    if (!records.length) { showError('Export Empty', 'No payroll records to export.'); return; }
    exportToCSV(`Payroll_Register_${selectedMonth}`, records.map(r => ({
      'Employee ID': r.employeeId, 'Employee Name': r.employeeName,
      Department: r.department, Designation: r.designation, Month: r.month,
      'Payable Days': r.payableDays, 'LOP Days': r.lopDays,
      'Gross Salary (₹)': r.grossSalary, 'Total Earnings (₹)': r.totalEarnings,
      'Total Deductions (₹)': r.totalDeductions, 'Net Salary (₹)': r.netSalary,
      Status: r.status,
    })));
    showSuccess('Export Complete', `Payroll ledger for ${selectedMonth} downloaded.`);
  };

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const columns: ColumnDef<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r: any) => (
        <div>
          <div className="font-semibold text-[var(--ink)] text-xs">{r.employeeName}</div>
          <div className="text-[10px] text-[var(--ink-muted)] font-mono">#{r.employeeId} · {r.designation || 'Staff'}</div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (r: any) => <span className="text-xs text-[var(--ink-muted)]">{r.department || '—'}</span>,
    },
    {
      key: 'payableDays',
      header: 'Payable Days',
      align: 'center',
      render: (r: any) => <span className="font-mono font-bold text-[var(--success)] text-xs">{r.payableDays}</span>,
    },
    {
      key: 'lopDays',
      header: 'LOP',
      align: 'center',
      render: (r: any) => (
        <span className={`font-mono font-medium text-xs ${r.lopDays > 0 ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}>
          {r.lopDays > 0 ? r.lopDays : '—'}
        </span>
      ),
    },
    {
      key: 'grossSalary',
      header: 'Gross Pay',
      align: 'right',
      render: (r: any) => <span className="font-mono text-xs text-[var(--ink)]">₹{fmt(r.grossSalary)}</span>,
    },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      align: 'right',
      render: (r: any) => (
        <span className="font-mono text-xs text-[var(--danger)]">
          {r.totalDeductions > 0 ? `-₹${fmt(r.totalDeductions)}` : '—'}
        </span>
      ),
    },
    {
      key: 'netSalary',
      header: 'Net Salary',
      align: 'right',
      render: (r: any) => <span className="font-mono font-bold text-xs text-[var(--gold-500)]">₹{fmt(r.netSalary)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: any) => {
        const cfg = STATUS_CONFIG[r.status];
        return cfg ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
            {r.status === 'Approved' && <Check size={10} />}
            {cfg.label} {r.isLocked ? '🔒' : ''}
          </span>
        ) : null;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r: any) => (
        <RowActionMenu
          actions={[
            { label: 'View Payslip', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => handleViewPayslip(r.id) },
            ...(canManage && r.status === 'Draft' ? [{ label: 'Approve', icon: <Check className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Approved'), variant: 'success' as const }] : []),
            ...(canManage && r.status === 'Approved' ? [{ label: 'Mark as Paid', icon: <CreditCard className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Paid'), variant: 'success' as const }] : []),
            ...(canManage ? archive.rowActions({
              id: r.id,
              name: `Payroll (${r.employeeName})`,
              isArchived: isRowArchived(r),
            }) : []),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Month Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
        {/* Month navigator */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-[var(--rule)] hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center min-w-[140px]">
            <div className="text-xl font-bold text-[var(--ink)] font-display leading-none">{month}</div>
            <div className="text-xs text-[var(--ink-muted)] mt-0.5">{year}</div>
          </div>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-[var(--rule)] hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3 cursor-pointer font-data"
          >
            <Download size={13} /> Export CSV
          </button>
          {canManage && (
            <button
              onClick={() => setProcessModalOpen(true)}
              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 cursor-pointer"
            >
              <Calculator size={14} /> Run Payroll
            </button>
          )}
        </div>
      </div>

      {/* ── Metrics ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Total Gross',      value: `₹${fmt(metrics.totalGross || 0)}`,      icon: <DollarSign size={18} />,   iconCls: 'text-[var(--accent)] bg-[var(--accent-light)]',   borderColor: 'var(--accent)'   },
          { label: 'Net Disbursable',  value: `₹${fmt(metrics.totalNet || 0)}`,         icon: <CheckCircle2 size={18} />, iconCls: 'text-[var(--success)] bg-[var(--success-light)]', borderColor: 'var(--success)'  },
          { label: 'Total Deductions', value: `₹${fmt(metrics.totalDeductions || 0)}`,  icon: <TrendingDown size={18} />, iconCls: 'text-[var(--danger)] bg-[var(--danger-light)]',   borderColor: 'var(--danger)'   },
          { label: 'Employees',        value: String(totalCount),                        icon: <Users2 size={18} />,       iconCls: 'text-[var(--warning)] bg-[var(--warning-light)]', borderColor: 'var(--warning)'  },
        ] as const).map(({ label, value, icon, iconCls, borderColor }) => (
          <div key={label}
            className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4 flex items-center gap-3"
            style={{ borderLeft: `4px solid ${borderColor}` }}
          >
            <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 ${iconCls}`}>
              {icon}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)] font-ui">{label}</div>
              <div className="text-lg font-bold font-data text-[var(--ink)] leading-tight">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Unified DataToolbar ──────────────────────────────────────────────── */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search employee by name, ID or designation..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        filters={[
          {
            id: 'status',
            ariaLabel: 'Status Filter',
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'Draft', label: 'Draft' },
              { value: 'Approved', label: 'Approved' },
              { value: 'Paid', label: 'Paid' },
            ],
          },
          {
            id: 'department',
            ariaLabel: 'Department Filter',
            value: departmentId,
            onChange: (v) => { setDepartmentId(v); setPage(1); },
            options: [
              { value: '', label: 'All Departments' },
              ...departments
                .filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                .map((d: any) => ({
                  value: String(d.departmentId || d.id),
                  label: d.departmentName,
                })),
            ],
          },
        ]}
      />

      {/* ── Reusable DataTable with Selection and Bulk Actions ──────────────── */}
      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        showSrNo={!canManage}
        selection={
          canManage
            ? {
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys),
                bulkActions: [
                  {
                    label: 'Approve Selected',
                    icon: <Check size={12} />,
                    variant: 'primary',
                    onClick: handleBulkApprove,
                  },
                  ...archive.bulkActions(archiveFilter === 'archived'),
                ],
              }
            : undefined
        }
        emptyMessage={`No payroll records found for ${month} ${year}. Click "Run Payroll" to generate monthly salaries.`}
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Modals */}
      <ProcessPayrollModal
        open={processModalOpen}
        onClose={() => setProcessModalOpen(false)}
        selectedMonth={selectedMonth}
        onDone={fetchRecords}
        departments={departments.map((d: any) => ({ id: d.departmentId || d.id, name: d.departmentName }))}
      />
      <PayslipModal
        open={payslipModalOpen}
        onClose={() => { setPayslipModalOpen(false); setSelectedPayslip(null); }}
        loading={loadingPayslip}
        payslip={selectedPayslip}
      />
      {archive.dialog}
    </div>
  );
};

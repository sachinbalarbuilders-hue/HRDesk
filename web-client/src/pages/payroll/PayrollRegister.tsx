import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/CompanyContext';
import { exportToCSV } from '../../utils/csvHelper';
import { PaginationToolbar } from '../../components/ui/PaginationToolbar';
import { ArchiveToggle, type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { ProcessPayrollModal } from './ProcessPayrollModal';
import { PayslipModal } from './PayslipModal';
import {
  ChevronLeft, ChevronRight, Check, CreditCard, FileText,
  Sparkles, Calculator, X, Download, Search,
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      await apiClient.post('/payroll/bulk-status', { ids: selectedIds, status: 'Approved' });
      showSuccess('Bulk Approved', `Approved ${selectedIds.length} records.`);
      setSelectedIds([]);
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

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === records.length ? [] : records.map(r => r.id));
  const toggleSelectId = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">

      {/* ── Month Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-xl">
        {/* Month navigator */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--rule)] hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center min-w-[140px]">
            <div className="text-xl font-bold text-[var(--ink)] font-display leading-none">{month}</div>
            <div className="text-xs text-[var(--ink-muted)] mt-0.5">{year}</div>
          </div>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--rule)] hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--rule)] rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)] transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
          {canManage && (
            <button
              onClick={() => setProcessModalOpen(true)}
              className="btn-primary flex items-center gap-1.5 text-xs"
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
            className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl p-4 flex items-center gap-3"
            style={{ borderLeft: `4px solid ${borderColor}` }}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
              {icon}
            </div>
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wide text-[var(--ink-muted)] font-ui">{label}</div>
              <div className="text-lg font-bold font-data text-[var(--ink)] leading-tight">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + Search bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search employee..."
            className="register-input w-full text-sm"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="register-input text-sm"
          style={{ width: '130px', flexShrink: 0 }}
        >
          <option value="all">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
          <option value="Paid">Paid</option>
        </select>

        {/* Department filter */}
        <select
          value={departmentId}
          onChange={e => { setDepartmentId(e.target.value); setPage(1); }}
          className="register-input text-sm"
          style={{ width: '160px', flexShrink: 0 }}
        >
          <option value="">All Departments</option>
          {departments
            .filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
            .map((d: any) => (
              <option key={d.departmentId || d.id} value={String(d.departmentId || d.id)}>
                {d.departmentName}
              </option>
            ))}
        </select>

        <ArchiveToggle value={archiveFilter} onChange={v => { setArchiveFilter(v); setPage(1); }} />

        {!loading && (
          <span className="text-xs text-[var(--ink-muted)] whitespace-nowrap" style={{ flexShrink: 0 }}>
            {totalCount} record{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────────── */}
      {selectedIds.length > 0 && canManage && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--accent-light)] border border-[var(--accent)]/30 rounded-lg text-xs">
          <span className="font-semibold text-[var(--accent)]">
            {selectedIds.length} record{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkApprove} className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
              <Check size={12} /> Approve Selected
            </button>
            <button onClick={() => setSelectedIds([])} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="border border-[var(--rule)] rounded-xl overflow-hidden bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)]">
                {canManage && (
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && selectedIds.length === records.length}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--rule)]"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Employee</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Department</th>
                <th className="px-4 py-3 text-center text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Payable Days</th>
                <th className="px-4 py-3 text-center text-[10px] uppercase font-bold text-[var(--danger)] font-ui">LOP</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Gross Pay</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Deductions</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-[var(--accent)] font-ui">Net Salary</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Status</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {loading ? (
                <tr><td colSpan={canManage ? 10 : 9} className="p-0"><TableSkeleton rows={8} /></td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className={`hover:bg-[var(--surface-sunken)] transition-colors ${selectedIds.includes(r.id) ? 'bg-[var(--accent-light)]' : 'bg-[var(--paper)]'}`}>
                  {canManage && (
                    <td className="px-3 py-3 text-center">
                      <input type="checkbox" checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelectId(r.id)}
                        className="rounded border-[var(--rule)]"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--ink)] text-sm">{r.employeeName}</div>
                    <div className="text-[11px] text-[var(--ink-muted)] font-mono">#{r.employeeId} · {r.designation}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">{r.department}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono font-bold text-[var(--success)] text-sm">{r.payableDays}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono font-medium text-sm ${r.lopDays > 0 ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}>
                      {r.lopDays > 0 ? r.lopDays : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--ink)]">₹{fmt(r.grossSalary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--danger)]">
                    {r.totalDeductions > 0 ? `-₹${fmt(r.totalDeductions)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[var(--accent)]">₹{fmt(r.netSalary)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const cfg = STATUS_CONFIG[r.status];
                      return cfg ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.cls}`}>
                          {r.status === 'Approved' && <Check size={10} />}
                          {cfg.label} {r.isLocked ? '🔒' : ''}
                        </span>
                      ) : null;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActionMenu actions={[
                      { label: 'View Payslip', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => handleViewPayslip(r.id) },
                      ...(canManage && r.status === 'Draft' ? [{ label: 'Approve', icon: <Check className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Approved'), variant: 'success' as const }] : []),
                      ...(canManage && r.status === 'Approved' ? [{ label: 'Mark as Paid', icon: <CreditCard className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Paid'), variant: 'success' as const }] : []),
                      ...(canManage ? archive.rowActions({
                        id: r.id,
                        name: `Payroll (${r.employeeName})`,
                        isArchived: isRowArchived(r)
                      }) : []),
                    ] as RowAction[]} />
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 10 : 9} className="py-16 text-center">
                    <Sparkles className="w-10 h-10 mx-auto mb-3 text-[var(--ink-muted)] opacity-30" />
                    <div className="font-semibold text-sm text-[var(--ink)]">
                      No payroll records for {month} {year}
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] mt-1 max-w-xs mx-auto">
                      Click <span className="font-semibold">Run Payroll</span> to generate monthly salaries based on attendance data.
                    </p>
                    {canManage && (
                      <button
                        onClick={() => setProcessModalOpen(true)}
                        className="btn-primary text-xs mt-4 inline-flex items-center gap-1.5"
                      >
                        <Calculator size={13} /> Run Payroll for {month} {year}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalCount > 0 && (
          <div className="border-t border-[var(--rule)] px-4 py-3 bg-[var(--surface-sunken)]">
            <PaginationToolbar
              page={page} pageSize={pageSize}
              totalCount={totalCount} totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

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

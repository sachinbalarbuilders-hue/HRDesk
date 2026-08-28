import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/CompanyContext';
import { exportToCSV } from '../../utils/csvHelper';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { PaginationToolbar } from '../../components/ui/PaginationToolbar';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { RowActionMenu } from '../../components/ui/RowActionMenu';
import { PayrollMetrics } from './PayrollMetrics';
import { ProcessPayrollModal } from './ProcessPayrollModal';
import { PayslipModal } from './PayslipModal';
import {
  ChevronLeft, ChevronRight, Check, CreditCard,
  FileText, Sparkles, Calculator, X,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getMonthDisplay = (yyyyMm: string) => {
  try {
    const [y, m] = yyyyMm.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  } catch { return yyyyMm; }
};

export const PayrollRegister: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [records, setRecords] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [skipLoans, setSkipLoans] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [loadingPayslip, setLoadingPayslip] = useState(false);

  const canManage = isAdmin || hasPermission('Payroll.Process');

  const fetchLookups = useCallback(async () => {
    try {
      const res = await apiClient.get('/employees/lookups', {
        params: { branchId: currentBranch?.id || undefined },
      });
      setDepartments(res.data?.departments || []);
    } catch { /* silent */ }
  }, [currentBranch?.id]);

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
          page,
          pageSize,
        },
      });
      setRecords(res.data?.items || []);
      setMetrics(res.data?.metrics || {});
      setTotalCount(res.data?.totalCount || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err: any) {
      showError('Failed to load payroll', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, search, departmentId, statusFilter, currentBranch?.id, page, pageSize]);

  useEffect(() => { fetchLookups(); }, [currentOrganization?.id, currentBranch?.id]);
  useEffect(() => { fetchRecords(); }, [selectedMonth, search, departmentId, statusFilter, currentOrganization?.id, currentBranch?.id, page, pageSize]);

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

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessing(true);
      const res = await apiClient.post('/payroll/process', { month: selectedMonth, skipLoans });
      showSuccess('Payroll Calculated', res.data.message || 'Processed successfully.');
      setProcessModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      showError('Processing Failed', err.response?.data?.message || 'Server error during calculation');
    } finally {
      setProcessing(false);
    }
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
    } finally {
      setLoadingPayslip(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await apiClient.post(`/payroll/${id}/status`, { status });
      showSuccess('Status Updated', `Payroll #${id} changed to ${status}.`);
      fetchRecords();
    } catch (err: any) {
      showError('Update Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      await apiClient.post('/payroll/bulk-status', { ids: selectedIds, status: 'Approved' });
      showSuccess('Bulk Approved', `Approved ${selectedIds.length} payroll records.`);
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

  return (
    <>
      <PayrollMetrics metrics={metrics} totalCount={totalCount} />

      {/* Toolbar */}
      <div className="space-y-3">
        <DataToolbar
          searchPlaceholder="Search employee by name in payroll..."
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              id: 'status', ariaLabel: 'Status Filter', value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
              options: [
                { label: 'All Statuses', value: 'all' },
                { label: 'Draft', value: 'Draft' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Paid', value: 'Paid' },
              ],
            },
            {
              id: 'department', ariaLabel: 'Department Filter', value: departmentId,
              onChange: (v) => { setDepartmentId(v); setPage(1); },
              options: [
                { value: '', label: 'All Departments' },
                ...departments
                  .filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                  .map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
              ],
            },
          ]}
          onExport={handleExportCSV}
          primaryAction={canManage ? {
            label: 'Process Payroll',
            icon: <Calculator className="w-3.5 h-3.5" />,
            onClick: () => setProcessModalOpen(true),
          } : undefined}
        >
          {/* Month Switcher */}
          <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
            <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors" title="Previous Month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap min-w-[130px] text-center">
              {getMonthDisplay(selectedMonth)}
            </span>
            <button onClick={handleNextMonth} className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors" title="Next Month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </DataToolbar>

        {/* Batch action bar */}
        {selectedIds.length > 0 && canManage && (
          <div className="bg-[var(--warning-light)] border border-[var(--warning)]/30 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-[var(--warning)]">
              <span className="font-bold font-data text-sm">{selectedIds.length}</span> record(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button onClick={handleBulkApprove} className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Approve Selected
              </button>
              <button onClick={() => setSelectedIds([])} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="register-table">
            <thead>
              <tr>
                {canManage && (
                  <th className="w-10 text-center">
                    <input type="checkbox"
                      checked={records.length > 0 && selectedIds.length === records.length}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--rule)]"
                    />
                  </th>
                )}
                <th className="w-12 text-center font-mono text-xs uppercase text-[var(--ink-muted)]">Sr.</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th className="text-center font-data">Payable Days</th>
                <th className="text-center font-data text-rose-600">LOP</th>
                <th className="text-right font-data">Gross Pay</th>
                <th className="text-right font-data text-rose-600">Deductions</th>
                <th className="text-right font-data font-bold text-[var(--accent)]">Net Salary</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canManage ? 11 : 10} className="p-0"><TableSkeleton rows={8} /></td></tr>
              ) : records.map((r, index) => (
                <tr key={r.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                  {canManage && (
                    <td className="text-center">
                      <input type="checkbox" checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelectId(r.id)}
                        className="rounded border-[var(--rule)]"
                      />
                    </td>
                  )}
                  <td className="text-center font-mono text-xs text-[var(--ink-muted)] w-12">{index + 1}</td>
                  <td>
                    <div className="font-semibold text-[var(--ink)]">{r.employeeName}</div>
                    <div className="text-[11px] text-[var(--ink-muted)] font-mono">#{r.employeeId} · {r.designation}</div>
                  </td>
                  <td className="text-xs text-[var(--ink-muted)]">{r.department}</td>
                  <td className="text-center font-mono font-semibold text-[var(--success)]">{r.payableDays}</td>
                  <td className="text-center font-mono font-medium text-[var(--danger)]">
                    {r.lopDays > 0 ? `-${r.lopDays}` : '0'}
                  </td>
                  <td className="text-right font-mono text-xs text-[var(--ink)]">₹{r.grossSalary.toLocaleString()}</td>
                  <td className="text-right font-mono text-xs text-[var(--danger)]">-₹{r.totalDeductions.toLocaleString()}</td>
                  <td className="text-right font-mono text-sm font-bold text-[var(--accent)]">₹{r.netSalary.toLocaleString()}</td>
                  <td>
                    {r.status === 'Draft' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--warning-light)] text-[var(--warning)]">Draft</span>
                    )}
                    {r.status === 'Approved' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--success-light)] text-[var(--success)]">
                        <Check className="w-3 h-3" /> Approved {r.isLocked && '🔒'}
                      </span>
                    )}
                    {r.status === 'Paid' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--info-light)] text-[var(--info)]">
                        Paid {r.isLocked && '🔒'}
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <RowActionMenu actions={[
                      { label: 'View Payslip', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => handleViewPayslip(r.id) },
                      ...(canManage && r.status === 'Draft' ? [{ label: 'Approve', icon: <Check className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Approved'), variant: 'success' as const }] : []),
                      ...(canManage && r.status === 'Approved' ? [{ label: 'Disburse', icon: <CreditCard className="w-3.5 h-3.5" />, onClick: () => handleUpdateStatus(r.id, 'Paid'), variant: 'success' as const }] : []),
                    ]} />
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="py-12 text-center text-xs text-[var(--ink-muted)]">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
                    <div className="font-semibold text-sm text-[var(--ink)]">
                      No Payroll Records for {getMonthDisplay(selectedMonth)}
                    </div>
                    <p className="mt-1">Click "Process Payroll" in the toolbar above to generate monthly salaries based on attendance ledger.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && (
          <div className="border-t border-[var(--rule)] p-3">
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
        onMonthChange={setSelectedMonth}
        skipLoans={skipLoans}
        onSkipLoansChange={setSkipLoans}
        processing={processing}
        onSubmit={handleProcessPayroll}
      />
      <PayslipModal
        open={payslipModalOpen}
        onClose={() => { setPayslipModalOpen(false); setSelectedPayslip(null); }}
        loading={loadingPayslip}
        payslip={selectedPayslip}
      />
    </>
  );
};

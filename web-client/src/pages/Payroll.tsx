import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  DollarSign,
  CreditCard,
  TrendingDown,
  CheckCircle2,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';

export const Payroll: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();

  const [records, setRecords] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Multi-Select
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [skipLoans, setSkipLoans] = useState(false);

  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [loadingPayslip, setLoadingPayslip] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchLookups = async () => {
    try {
      const res = await apiClient.get('/employees/lookups', {
        params: { branchId: currentBranch?.id || undefined }
      });
      setDepartments(res.data?.departments || []);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [currentOrganization?.id, currentBranch?.id]);

  const fetchPayrollRecords = async () => {
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
  };

  useEffect(() => {
    fetchPayrollRecords();
  }, [selectedMonth, search, departmentId, statusFilter, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchLookups();
      fetchPayrollRecords();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [selectedMonth, search, departmentId, statusFilter, currentOrganization?.id, currentBranch?.id]);

  const handlePrevMonth = () => {
    setPage(1);
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    setSelectedMonth(prev);
  };

  const handleNextMonth = () => {
    setPage(1);
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    setSelectedMonth(next);
  };

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessing(true);
      const res = await apiClient.post('/payroll/process', {
        month: selectedMonth,
        skipLoans,
      });
      showSuccess('Payroll Calculated', res.data.message || 'Processed successfully.');
      setProcessModalOpen(false);
      fetchPayrollRecords();
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
      showSuccess('Status Updated', `Payroll #${id} status changed to ${status}.`);
      fetchPayrollRecords();
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
      fetchPayrollRecords();
    } catch (err: any) {
      showError('Bulk Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!records.length) {
      showError('Export Empty', 'No payroll records to export.');
      return;
    }

    const rows = records.map(r => ({
      'Employee ID': r.employeeId,
      'Employee Name': r.employeeName,
      Department: r.department,
      Designation: r.designation,
      Month: r.month,
      'Payable Days': r.payableDays,
      'LOP Days': r.lopDays,
      'Gross Salary (₹)': r.grossSalary,
      'Total Earnings (₹)': r.totalEarnings,
      'Total Deductions (₹)': r.totalDeductions,
      'Net Salary (₹)': r.netSalary,
      Status: r.status,
    }));

    exportToCSV(`Payroll_Register_${selectedMonth}`, rows);
    showSuccess('Export Complete', `Payroll ledger for ${selectedMonth} downloaded.`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const canManage = isAdmin || hasPermission('Payroll.Process');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getMonthDisplay = (yyyyMm: string) => {
    try {
      const [y, m] = yyyyMm.split('-').map(Number);
      return `${monthNames[m - 1]} ${y}`;
    } catch {
      return yyyyMm;
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Monthly Payroll" description="Process and manage salary disbursements" />

      {/* 2. Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--accent)]">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[var(--accent)] flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Gross CTC</div>
            <div className="text-lg font-bold font-data text-[var(--ink)]">₹{(metrics.totalGross || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Net Disbursable</div>
            <div className="text-lg font-bold font-data text-emerald-700 dark:text-emerald-300">₹{(metrics.totalNet || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-rose-500">
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Deductions</div>
            <div className="text-lg font-bold font-data text-rose-700 dark:text-rose-300">₹{(metrics.totalDeductions || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-amber-500">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Processed Roster</div>
            <div className="text-lg font-bold font-data text-[var(--ink)]">{totalCount} Employees</div>
          </div>
        </div>
      </div>

      {/* 3. Unified Common Action Toolbar */}
      <div className="space-y-3">
        <DataToolbar
          searchPlaceholder="Search employee by name in payroll..."
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              id: 'status',
              ariaLabel: 'Status Filter',
              value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
              options: [
                { label: 'All Statuses', value: 'all' },
                { label: 'Draft', value: 'Draft' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Paid', value: 'Paid' },
              ],
            },
            {
              id: 'department',
              ariaLabel: 'Department Filter',
              value: departmentId,
              onChange: (v) => { setDepartmentId(v); setPage(1); },
              options: [
                { value: '', label: 'All Departments' },
                ...departments.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id)).map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
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
          {/* Month Switcher inside DataToolbar */}
          <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap min-w-[130px] text-center">
              {getMonthDisplay(selectedMonth)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </DataToolbar>

        {/* Batch Action Bar */}
        {selectedIds.length > 0 && canManage && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium">
              <span className="font-bold font-data text-sm">{selectedIds.length}</span> payroll record(s) selected.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="btn-primary py-1 px-3 text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Primary Table: Ruled Ledger Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="register-table">
            <thead>
              <tr>
                {canManage && (
                  <th className="w-10 text-center">
                    <input
                      type="checkbox"
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
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="p-0">
                    <TableSkeleton rows={8} />
                  </td>
                </tr>
              ) : records.map((r, index) => (
                <tr key={r.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                  {canManage && (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelectId(r.id)}
                        className="rounded border-[var(--rule)]"
                      />
                    </td>
                  )}

                  <td className="text-center font-mono text-xs text-[var(--ink-muted)] w-12">
                    {index + 1}
                  </td>

                  <td>
                    <div className="font-semibold text-[var(--ink)]">{r.employeeName}</div>
                    <div className="text-[11px] text-[var(--ink-muted)] font-mono">#{r.employeeId} · {r.designation}</div>
                  </td>

                  <td className="text-xs text-[var(--ink-muted)]">
                    {r.department}
                  </td>

                  <td className="text-center font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    {r.payableDays}
                  </td>

                  <td className="text-center font-mono font-medium text-rose-600">
                    {r.lopDays > 0 ? `-${r.lopDays}` : '0'}
                  </td>

                  <td className="text-right font-mono text-xs text-[var(--ink)]">
                    ₹{r.grossSalary.toLocaleString()}
                  </td>

                  <td className="text-right font-mono text-xs text-rose-600">
                    -₹{r.totalDeductions.toLocaleString()}
                  </td>

                  <td className="text-right font-mono text-sm font-bold text-[var(--accent)]">
                    ₹{r.netSalary.toLocaleString()}
                  </td>

                  <td>
                    {r.status === 'Draft' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Draft
                      </span>
                    )}
                    {r.status === 'Approved' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Approved {r.isLocked && <span title="Locked">🔒</span>}
                      </span>
                    )}
                    {r.status === 'Paid' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                        Paid {r.isLocked && <span title="Locked">🔒</span>}
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
                    <div className="font-semibold text-sm text-[var(--ink)]">No Payroll Records for {getMonthDisplay(selectedMonth)}</div>
                    <p className="mt-1">Click "Process Payroll" in the toolbar above to generate monthly salaries based on attendance ledger.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination */}
        {totalCount > 0 && (
          <div className="border-t border-[var(--rule)] p-3">
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. PROCESS PAYROLL MODAL */}
      {/* ========================================================================= */}
      {processModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Run Payroll</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Calculate earnings, LOP deductions, and loan installments.</p>
              </div>
              <button
                onClick={() => setProcessModalOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessPayroll} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Processing Month *</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="register-input font-data"
                  required
                />
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!skipLoans}
                    onChange={(e) => setSkipLoans(!e.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--accent)]"
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Include Loan EMI Deductions</span>
                </label>
                <p className="text-xs text-[var(--text-muted)] pl-6">
                  Automatically deducts scheduled monthly installments from employee loan accounts.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--warning-light)] border border-[var(--warning)]/20 space-y-1">
                <div className="font-medium text-sm flex items-center gap-1.5 text-[var(--warning)]">
                  <AlertCircle className="w-4 h-4" />
                  <span>Attendance Verification</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Payable days, LOP, and Comp-Off credits are validated against the shared attendance engine.
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProcessModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="btn-primary"
                >
                  {processing ? 'Calculating...' : 'Start Payroll Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FORMAL INTERACTIVE PAYSLIP VIEWER MODAL */}
      {/* ========================================================================= */}
      {payslipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden">
            {/* Modal Controls Bar */}
            <div className="p-3 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)] no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-serif font-bold text-sm text-[var(--ink)]">Official Payslip Statement</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setPayslipModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Payslip Paper Sheet */}
            {loadingPayslip || !selectedPayslip ? (
              <div className="p-12">
                <TableSkeleton rows={8} />
              </div>
            ) : (
              <div ref={printRef} className="p-8 bg-white text-slate-900 font-sans space-y-6 text-xs print:p-0">
                {/* 1. Company Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-serif font-bold tracking-tight text-slate-900 uppercase">
                      {selectedPayslip.organization.name}
                    </h2>
                    <p className="text-[11px] text-slate-600 mt-0.5">{selectedPayslip.organization.address}</p>
                    <p className="text-[11px] text-slate-600">Company Code: <span className="font-mono font-semibold">{selectedPayslip.organization.code}</span></p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-serif font-bold text-xs uppercase tracking-wider text-slate-800">
                      Payslip for {selectedPayslip.monthDisplay}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      Status: <span className="font-semibold text-emerald-700">{selectedPayslip.status}</span>
                      {selectedPayslip.isLocked && <span className="ml-2">🔒 Locked</span>}
                      {selectedPayslip.salaryBasis && <span className="ml-2 text-slate-400">· Basis: {selectedPayslip.salaryBasis}</span>}
                      {selectedPayslip.isProrated && <span className="ml-2 text-amber-600 font-semibold">· Prorated ({selectedPayslip.proratedDays} days)</span>}
                    </div>
                  </div>
                </div>

                {/* 2. Employee & Bank Particulars Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 bg-slate-50 border border-slate-200 rounded text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">Employee Name:</span>{' '}
                    <span className="font-bold text-slate-900">{selectedPayslip.employee.employeeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Employee ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">#{selectedPayslip.employee.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Department:</span>{' '}
                    <span className="font-semibold text-slate-800">{selectedPayslip.employee.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Designation:</span>{' '}
                    <span className="font-semibold text-slate-800">{selectedPayslip.employee.designation}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Bank A/C:</span>{' '}
                    <span className="font-mono font-semibold text-slate-800">{selectedPayslip.employee.bankAccount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Bank / IFSC:</span>{' '}
                    <span className="font-mono font-semibold text-slate-800">{selectedPayslip.employee.ifsc}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">PAN Number:</span>{' '}
                    <span className="font-mono font-semibold text-slate-800">{selectedPayslip.employee.pan}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">UAN Number:</span>{' '}
                    <span className="font-mono font-semibold text-slate-800">{selectedPayslip.employee.uan}</span>
                  </div>
                </div>

                {/* 3. Attendance Summary Strip */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2.5 bg-slate-100 border border-slate-200 rounded text-center text-[11px] font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500">Days in Month</div>
                    <div className="font-bold text-slate-800">{selectedPayslip.attendance.totalDays}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Present (P)</div>
                    <div className="font-bold text-slate-800">{selectedPayslip.attendance.presentDays}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Week Off (WO)</div>
                    <div className="font-bold text-slate-800">{selectedPayslip.attendance.weekoffs}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Holidays (HLD)</div>
                    <div className="font-bold text-slate-800">{selectedPayslip.attendance.holidays}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 text-rose-600 font-semibold">Loss of Pay</div>
                    <div className="font-bold text-rose-600">{selectedPayslip.attendance.unpaidLeaves}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-700 font-semibold">Payable Days</div>
                    <div className="font-bold text-emerald-700 text-sm">{selectedPayslip.attendance.payableDays}</div>
                  </div>
                </div>

                {/* 4. Side-by-Side Earnings & Deductions Tables */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Earnings */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider flex justify-between">
                      <span>Earnings</span>
                      <span>Amount (₹)</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {selectedPayslip.earnings.map((e: any, idx: number) => (
                        <div key={idx} className="px-3 py-1.5 flex justify-between text-[11px]">
                          <span className="text-slate-700 font-medium">{e.componentName}</span>
                          <span className="font-mono font-semibold text-slate-900">₹{e.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-100 border-t-2 border-slate-300 px-3 py-2 flex justify-between font-bold text-xs text-slate-900">
                      <span>Total Earnings</span>
                      <span className="font-mono">₹{selectedPayslip.totals.totalEarnings.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider flex justify-between">
                      <span>Deductions</span>
                      <span>Amount (₹)</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {selectedPayslip.deductions.map((d: any, idx: number) => (
                        <div key={idx} className="px-3 py-1.5 flex justify-between text-[11px]">
                          <span className="text-slate-700 font-medium">{d.componentName}</span>
                          <span className="font-mono font-semibold text-rose-700">₹{d.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {selectedPayslip.deductions.length === 0 && (
                        <div className="px-3 py-4 text-center text-slate-400 text-[11px]">
                          No statutory or loan deductions.
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-100 border-t-2 border-slate-300 px-3 py-2 flex justify-between font-bold text-xs text-rose-700">
                      <span>Total Deductions</span>
                      <span className="font-mono">₹{selectedPayslip.totals.totalDeductions.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Net Pay Highlight Strip */}
                <div className="p-4 bg-emerald-50 border-2 border-emerald-600 rounded flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-900">Net Salary Payable</div>
                    <div className="text-xs text-emerald-800 mt-0.5 font-medium italic">
                      ({selectedPayslip.totals.netSalaryInWords})
                    </div>
                  </div>
                  <div className="text-2xl font-serif font-bold text-emerald-900 font-mono">
                    ₹{selectedPayslip.totals.netSalary.toLocaleString()}
                  </div>
                </div>

                {/* 6. Signatures & Footer */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-slate-500">
                  <div>
                    <div className="h-10 border-b border-slate-400 w-48 mb-1" />
                    <div>Employee Signature</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="h-10 border-b border-slate-400 w-48 mb-1" />
                    <div>Authorised Signatory</div>
                    <div className="text-[10px] text-slate-400">{selectedPayslip.organization.name}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
};


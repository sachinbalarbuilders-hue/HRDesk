import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import {
  DollarSign,
  Plus,
  CheckCircle,
  XCircle,
  X,
  CreditCard,
  Receipt,
  TrendingDown,
  Building2,
  Check,
} from 'lucide-react';

interface LoanRecord {
  id: number;
  appNumber: string;
  appDate: string;
  employeeId: number;
  employeeName: string;
  department: string;
  loanType: string;
  loanTypeId: number;
  principalAmount: number;
  monthlyEmi: number;
  tenureMonths: number;
  paidMonths: number;
  remainingAmount: number;
  startMonth: string;
  status: 'Pending' | 'Approved' | 'Disbursed' | 'Closed' | 'Rejected';
  reason: string;
  approvedBy: string | null;
}

export const Loans: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();

  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loanTypes, setLoanTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ employeeId: number; employeeName: string }>>([]);
  const [stats, setStats] = useState({
    totalDisbursed: 0,
    totalOutstanding: 0,
    totalRecovered: 0,
    activeLoansCount: 0,
    pendingRequestsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    employeeId: 0,
    loanTypeId: 1,
    principalAmount: 25000,
    tenureMonths: 5,
    startDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const fetchLookups = async () => {
    try {
      const [typesRes, empRes] = await Promise.all([
        apiClient.get('/loans/types'),
        apiClient.get('/employees?pageSize=200'),
      ]);
      const types = typesRes.data || [];
      const emps = (empRes.data.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setLoanTypes(types);
      setEmployees(emps);
      if (types.length > 0 && form.loanTypeId === 1) {
        setForm(prev => ({ ...prev, loanTypeId: types[0].id }));
      }
      if (emps.length > 0 && form.employeeId === 0) {
        setForm(prev => ({ ...prev, employeeId: emps[0].employeeId }));
      }
    } catch (e) {
      console.error('Failed to load loan lookups', e);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/loans', {
        params: {
          status: statusFilter !== 'all' && statusFilter ? statusFilter : undefined,
          loanTypeId: typeFilter && typeFilter !== 'all' ? parseInt(typeFilter) : undefined,
          search: search || undefined,
          page,
          pageSize,
        },
      });
      setLoans(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err: any) {
      showError('Failed to fetch loans', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [statusFilter, typeFilter, search, page, pageSize]);

  const handleApprove = async (id: number) => {
    try {
      await apiClient.post(`/loans/${id}/approve`);
      showSuccess('Loan Approved', 'Loan application marked as Approved.');
      fetchLoans();
    } catch (err: any) {
      showError('Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleDisburse = async (id: number) => {
    try {
      await apiClient.post(`/loans/${id}/disburse`);
      showSuccess('Loan Disbursed', 'Principal amount marked as Disbursed. EMI deduction will begin on schedule.');
      fetchLoans();
    } catch (err: any) {
      showError('Disbursement Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenReject = (id: number) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetId) return;
    try {
      await apiClient.post(`/loans/${rejectTargetId}/reject`, { remarks: rejectReason });
      showSuccess('Loan Rejected', 'Loan application has been rejected.');
      setRejectModalOpen(false);
      setRejectTargetId(null);
      fetchLoans();
    } catch (err: any) {
      showError('Rejection Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/loans', form);
      showSuccess('Application Submitted', 'Loan request submitted with scheduled EMI breakdown.');
      setApplyModalOpen(false);
      fetchLoans();
    } catch (err: any) {
      showError('Submission Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!loans.length) {
      showError('Export Empty', 'No loan records to export.');
      return;
    }

    exportToCSV(
      'Employee_Loans_Ledger',
      loans.map(l => ({
        'App Number': l.appNumber,
        'App Date': l.appDate,
        'Employee Name': l.employeeName,
        Department: l.department,
        'Loan Type': l.loanType,
        'Principal Amount': l.principalAmount,
        'Monthly EMI': l.monthlyEmi,
        'Tenure (Months)': l.tenureMonths,
        'Remaining Amount': l.remainingAmount,
        'Start Month': l.startMonth,
        Status: l.status,
        'Approved By': l.approvedBy || '',
      }))
    );
  };

  const canManage = isAdmin || hasPermission('Payroll.ManageLoans');

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tracking-widest text-[var(--accent)] uppercase font-semibold">
            Finance & Advances
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[11px] font-mono text-[var(--ink-muted)]">Salary Advances & EMIs</span>
        </div>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-[var(--ink)] mt-1">
          Employee Loans & Advances Register
        </h1>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Manage company advances, emergency aid, installment schedules, and payroll auto-deductions.
        </p>
      </div>

      {/* 2. Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--accent)]">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[var(--accent)] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Disbursed</div>
            <div className="text-lg font-bold font-data text-[var(--ink)]">₹{stats.totalDisbursed.toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-amber-500">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Outstanding Balance</div>
            <div className="text-lg font-bold font-data text-amber-700 dark:text-amber-300">₹{stats.totalOutstanding.toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Recovered Amount</div>
            <div className="text-lg font-bold font-data text-emerald-700 dark:text-emerald-300">₹{stats.totalRecovered.toLocaleString()}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-purple-500">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Active Loan Accounts</div>
            <div className="text-lg font-bold font-data text-[var(--ink)]">{stats.activeLoansCount} Accounts</div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <DataToolbar
        searchPlaceholder="Search application #, employee, or reason..."
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
              { label: 'Pending Review', value: 'Pending' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Disbursed / Active', value: 'Disbursed' },
              { label: 'Closed', value: 'Closed' },
              { label: 'Rejected', value: 'Rejected' },
            ],
          },
          {
            id: 'type',
            ariaLabel: 'Loan Type Filter',
            value: typeFilter,
            onChange: (v) => { setTypeFilter(v); setPage(1); },
            options: [
              { label: 'All Loan Types', value: 'all' },
              ...loanTypes.map(t => ({ label: t.name, value: String(t.id) })),
            ],
          },
        ]}
        onExport={handleExport}
        onImport={() => setImportModalOpen(true)}
        importLabel="Import Loans"
        primaryAction={{
          label: 'Apply Loan / Advance',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => setApplyModalOpen(true),
        }}
      />

      {/* 4. Loans Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
            <div className="font-semibold text-sm text-[var(--ink)]">No Loan Applications Found</div>
            <p className="mt-1">There are no employee loan records matching the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] bg-[var(--paper-subtle)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 font-semibold">Application #</th>
                  <th className="p-3.5 font-semibold">Employee</th>
                  <th className="p-3.5 font-semibold">Type</th>
                  <th className="p-3.5 font-semibold">Principal</th>
                  <th className="p-3.5 font-semibold">Monthly EMI</th>
                  <th className="p-3.5 font-semibold">Repayment Progress</th>
                  <th className="p-3.5 font-semibold">Remaining</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                    <td className="p-3.5 font-mono font-semibold text-[var(--accent)]">
                      {l.appNumber}
                      <div className="text-[10px] text-[var(--ink-muted)] font-normal">
                        {l.appDate}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-[var(--ink)]">{l.employeeName}</div>
                      <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span>{l.department}</span>
                      </div>
                    </td>

                    <td className="p-3.5 font-medium text-[var(--ink)]">
                      {l.loanType}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-[var(--ink)]">
                      ₹{l.principalAmount.toLocaleString()}
                    </td>

                    <td className="p-3.5 font-mono text-indigo-600 font-semibold">
                      ₹{l.monthlyEmi.toLocaleString()} / mo
                    </td>

                    <td className="p-3.5">
                      <div className="text-[11px] font-mono mb-1">
                        <span className="font-bold text-[var(--ink)]">{l.paidMonths}</span> of {l.tenureMonths} EMIs Paid
                      </div>
                      <div className="w-28 h-1.5 rounded-full bg-[var(--rule)] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (l.paidMonths / (l.tenureMonths || 1)) * 100)}%` }}
                        />
                      </div>
                    </td>

                    <td className="p-3.5 font-mono font-bold text-amber-700 dark:text-amber-300">
                      ₹{l.remainingAmount.toLocaleString()}
                    </td>

                    <td className="p-3.5">
                      {l.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending
                        </span>
                      )}
                      {l.status === 'Approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          <Check className="w-3 h-3 text-blue-600" />
                          Approved
                        </span>
                      )}
                      {l.status === 'Disbursed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Disbursed
                        </span>
                      )}
                      {l.status === 'Closed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          Closed
                        </span>
                      )}
                      {l.status === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                          <X className="w-3 h-3 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      {canManage && l.status === 'Pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(l.id)}
                            title="Approve Loan"
                            className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReject(l.id)}
                            title="Reject Loan"
                            className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {canManage && l.status === 'Approved' && (
                        <button
                          onClick={() => handleDisburse(l.id)}
                          className="btn-primary text-[11px] py-1 px-2.5 shadow-xs"
                        >
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && totalCount > 0 && (
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

      {/* 5. Apply Loan Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ink)]">Apply Employee Loan / Advance</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Configure repayment tenure and automated monthly EMI deduction.</p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Select Employee *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: parseInt(e.target.value) || 0 })}
                  className="input-field w-full font-medium"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeName} (#{e.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Loan / Advance Type *</label>
                  <select
                    value={form.loanTypeId}
                    onChange={(e) => setForm({ ...form, loanTypeId: parseInt(e.target.value) || 1 })}
                    className="input-field w-full"
                  >
                    {loanTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Principal Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: parseFloat(e.target.value) || 0 })}
                    className="input-field w-full font-mono font-bold"
                    min={1000}
                    step={500}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Repayment Tenure (Months) *</label>
                  <input
                    type="number"
                    value={form.tenureMonths}
                    onChange={(e) => setForm({ ...form, tenureMonths: parseInt(e.target.value) || 1 })}
                    className="input-field w-full font-mono"
                    min={1}
                    max={60}
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Deduction Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
              </div>

              {/* Calculated EMI preview */}
              <div className="p-3 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)] flex items-center justify-between font-mono text-xs">
                <span className="text-[var(--ink-muted)]">Calculated Monthly EMI:</span>
                <span className="text-sm font-bold text-indigo-600">
                  ₹{Math.round(form.principalAmount / (form.tenureMonths || 1)).toLocaleString()} / month
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Purpose / Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="State the purpose of loan application (e.g. Medical emergency, housing advance)..."
                  rows={2}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-serif font-bold text-base text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-5 h-5" /> Reject Loan Application
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Specify the reason for rejecting this loan request.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Existing active advance / Exceeds eligibility threshold..."
              rows={3}
              className="input-field w-full text-xs"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Employee Loans"
        templateFilename="Employee_Loans"
        templateHeaders={['EmployeeId', 'LoanTypeCode', 'PrincipalAmount', 'TenureMonths', 'StartDate', 'Reason']}
        templateSampleRow={['1042', 'ADV', '25000', '5', '2026-09-01', 'Emergency advance']}
        onImportComplete={() => {
          showSuccess('Imported', 'Loans imported successfully.');
          fetchLoans();
        }}
      />
    </div>
  );
};

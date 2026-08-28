import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
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
  Eye,
  Sliders,
  Pencil,
  Trash2,
} from 'lucide-react';

interface LoanRecord {
  id: number;
  appNumber: string;
  applicationNumber: string;
  appDate: string;
  applicationDate: string;
  employeeId: number;
  employeeName: string;
  department: string;
  loanType: string;
  loanTypeId: number;
  loanTypeName: string;
  principalAmount: number;
  monthlyEmi: number;
  tenureMonths: number;
  paidMonths: number;
  remainingInstallments: number;
  remainingAmount: number;
  startMonth: string;
  startDate: string;
  status: 'Pending' | 'Manager Approved' | 'Approved' | 'Disbursed' | 'Closed' | 'Rejected';
  reason: string;
  approvedBy: string | null;
  approvedDate: string | null;
  foreclosureRemark: string;
  startingPaidInstallments: number;
  createdAt: string;
}

export const Loans: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const { currentOrganization, currentBranch } = useOrganization();
  const navigate = useNavigate();

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
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
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
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [prefixForm, setPrefixForm] = useState({
    seriesCode: 'LN',
    connector: '-',
    paddingDigits: 3,
    startSequence: 1,
  });

  const [form, setForm] = useState({
    employeeId: 0,
    loanTypeId: 1,
    principalAmount: 25000,
    tenureMonths: 5,
    startDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);

  const fetchPrefixSettings = async () => {
    try {
      const res = await apiClient.get('/loans/prefix-settings', {
        params: { branchId: currentBranch?.id || undefined }
      });
      if (res.data) {
        setPrefixForm({
          seriesCode: res.data.seriesCode || 'LN',
          connector: res.data.connector ?? '-',
          paddingDigits: res.data.paddingDigits || 3,
          startSequence: res.data.nextSequence || 1,
        });
      }
    } catch (e) {
      console.error('Failed to load loan prefix settings', e);
    }
  };

  const handleSavePrefixSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPrefix(true);
      await apiClient.post('/loans/prefix-settings', {
        seriesCode: prefixForm.seriesCode.trim(),
        connector: prefixForm.connector,
        paddingDigits: Number(prefixForm.paddingDigits),
        startSequence: Number(prefixForm.startSequence),
      }, {
        params: { branchId: currentBranch?.id || undefined }
      });
      showSuccess(
        'Prefix Configured',
        `Loan number format set to ${prefixForm.seriesCode}${prefixForm.connector}${String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}.`
      );
      setPrefixModalOpen(false);
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not save prefix settings');
    } finally {
      setSavingPrefix(false);
    }
  };

  const handleOpenApply = () => {
    setForm({
      employeeId: employees.length > 0 ? employees[0].employeeId : 0,
      loanTypeId: loanTypes.length > 0 ? loanTypes[0].id : 1,
      principalAmount: 25000,
      tenureMonths: 5,
      startDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
    setApplyModalOpen(true);
  };

  const fetchLookups = async () => {
    try {
      const [typesRes, empRes] = await Promise.all([
        apiClient.get('/loans/types', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/employees?pageSize=200', { params: { branchId: currentBranch?.id || undefined } }),
      ]);
      const types = typesRes.data || [];
      const emps = (empRes.data.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setLoanTypes(types);
      setEmployees(emps);
      setForm(prev => ({
        ...prev,
        employeeId: prev.employeeId && emps.some((x: any) => x.employeeId === prev.employeeId)
          ? prev.employeeId
          : (emps.length > 0 ? emps[0].employeeId : 0),
        loanTypeId: prev.loanTypeId && types.some((x: any) => x.id === prev.loanTypeId)
          ? prev.loanTypeId
          : (types.length > 0 ? types[0].id : 1),
      }));
    } catch (e) {
      console.error('Failed to load loan lookups', e);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [currentOrganization?.id, currentBranch?.id]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      // Map archive filter to API status
      let effectiveStatus = statusFilter !== 'all' && statusFilter ? statusFilter : undefined;
      if (!effectiveStatus && archiveFilter === 'active') {
        effectiveStatus = 'active'; // Pending, Approved, Disbursed
      } else if (!effectiveStatus && archiveFilter === 'archived') {
        effectiveStatus = 'archived'; // Closed, Rejected
      }

      const res = await apiClient.get('/loans', {
        params: {
          status: effectiveStatus,
          loanTypeId: typeFilter && typeFilter !== 'all' ? parseInt(typeFilter) : undefined,
          search: search || undefined,
          branchId: currentBranch?.id || undefined,
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
  }, [statusFilter, typeFilter, search, archiveFilter, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchLookups();
      fetchLoans();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [statusFilter, typeFilter, search, archiveFilter, currentOrganization?.id, currentBranch?.id]);

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

  const handleOpenEdit = (loan: LoanRecord) => {
    setEditingLoanId(loan.id);
    setForm({
      employeeId: loan.employeeId,
      loanTypeId: loan.loanTypeId,
      principalAmount: loan.principalAmount,
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
      reason: loan.reason,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoanId) return;
    try {
      setSubmitting(true);
      await apiClient.put(`/loans/${editingLoanId}`, {
        employeeId: form.employeeId,
        loanTypeId: form.loanTypeId,
        principalAmount: form.principalAmount,
        tenureMonths: form.tenureMonths,
        startDate: form.startDate,
        reason: form.reason,
      });
      showSuccess('Loan Updated', 'Loan application updated successfully.');
      setEditModalOpen(false);
      setEditingLoanId(null);
      fetchLoans();
    } catch (err: any) {
      showError('Update Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this loan application? This action cannot be undone and all associated installment records will be removed.')) return;
    try {
      await apiClient.delete(`/loans/${id}`);
      showSuccess('Loan Deleted', 'Loan application permanently deleted.');
      fetchLoans();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpId = form.employeeId || (employees.length > 0 ? employees[0].employeeId : 0);
    if (!targetEmpId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }

    const targetLoanTypeId = form.loanTypeId || (loanTypes.length > 0 ? loanTypes[0].id : 1);

    try {
      setSubmitting(true);
      await apiClient.post('/loans', {
        ...form,
        employeeId: targetEmpId,
        loanTypeId: targetLoanTypeId,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
      });
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
        'Application Date': l.appDate,
        'Employee ID': l.employeeId,
        'Employee Name': l.employeeName,
        Department: l.department,
        'Loan Type': l.loanType,
        'Principal Amount': l.principalAmount,
        'Monthly EMI': l.monthlyEmi,
        'Tenure (Months)': l.tenureMonths,
        'Paid Months': l.paidMonths,
        'Remaining Installments': l.remainingInstallments,
        'Remaining Amount': l.remainingAmount,
        'Start Date': l.startDate,
        Reason: l.reason,
        Status: l.status,
        'Approved By': l.approvedBy || '',
        'Approved Date': l.approvedDate || '',
        'Foreclosure Remark': l.foreclosureRemark || '',
        'Created At': l.createdAt,
      }))
    );
  };

  const canManage = isAdmin || hasPermission('Payroll.ManageLoans');

  return (
    <PageContainer>
      <PageHeader title="Loans & Advances" description="Manage company advances, EMI schedules, and payroll deductions" />


      {/* 3. Toolbar & Filters */}
      <DataToolbar
        searchPlaceholder="Search application #, employee, or reason..."
        searchValue={search}
        onSearchChange={setSearch}
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
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending Review', value: 'Pending' },
              { label: 'Manager Approved', value: 'Manager Approved' },
              { label: 'HR Approved', value: 'Approved' },
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
        customActions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                fetchPrefixSettings();
                setPrefixModalOpen(true);
              }}
              className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold cursor-pointer border-[var(--rule)] hover:border-[var(--gold-500)] text-[var(--ink)]"
              title="Configure Loan Application Number Prefix"
            >
              <Sliders size={13} className="text-[var(--gold-500)]" />
              <span>Prefix Setup</span>
            </button>
          ) : undefined
        }
        primaryAction={{
          label: 'Apply Loan / Advance',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: handleOpenApply,
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
                  <th className="p-3.5 font-semibold w-12 text-center">Sr.</th>
                  <th className="p-3.5 font-semibold">Application #</th>
                  <th className="p-3.5 font-semibold">Employee</th>
                  <th className="p-3.5 font-semibold">Type</th>
                  <th className="p-3.5 font-semibold">Principal</th>
                  <th className="p-3.5 font-semibold">Monthly EMI</th>
                  <th className="p-3.5 font-semibold">Remaining</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {loans.map((l, idx) => {
                  const srNo = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr key={l.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                      <td className="p-3.5 font-mono text-center text-xs text-[var(--ink-muted)]">
                        {srNo}
                      </td>

                      <td className="p-3.5 font-mono font-semibold text-[var(--accent)]">
                        <button
                          onClick={() => navigate(`/loans/${l.id}`)}
                          className="hover:underline cursor-pointer text-left"
                          title="View payment summary"
                        >
                          {l.appNumber}
                        </button>
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
                      {l.status === 'Manager Approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                          <Check className="w-3 h-3 text-indigo-600" />
                          Mgr Approved
                        </span>
                      )}
                      {l.status === 'Approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          <Check className="w-3 h-3 text-blue-600" />
                          HR Approved
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
                      <RowActionMenu actions={[
                        { label: 'View Details', icon: <Eye size={14} />, onClick: () => navigate(`/loans/${l.id}`) },
                        ...(canManage && (l.status === 'Pending' || l.status === 'Manager Approved') ? [
                          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => handleOpenEdit(l) },
                          { label: l.status === 'Pending' ? 'Manager Approve' : 'HR Approve', icon: <Check size={14} />, onClick: () => handleApprove(l.id), variant: 'success' as const },
                          { label: 'Reject', icon: <X size={14} />, onClick: () => handleOpenReject(l.id), variant: 'danger' as const },
                          { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(l.id), variant: 'danger' as const, dividerBefore: true },
                        ] : []),
                        ...(canManage && l.status === 'Approved' ? [
                          { label: 'Disburse', icon: <Check size={14} />, onClick: () => handleDisburse(l.id), variant: 'success' as const },
                        ] : []),
                        ...(canManage && (l.status === 'Closed' || l.status === 'Rejected') ? [
                          { label: 'Permanently Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(l.id), variant: 'danger' as const, dividerBefore: true },
                        ] : []),
                      ] as RowAction[]} />
                    </td>
                  </tr>
                );
              })}
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

      {/* 5. Apply Loan Slide-in Panel (Left) */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  Finance & Advances
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                  Apply Loan / Advance
                </h2>
                <p className="text-xs text-[var(--ink-muted)]">Configure repayment tenure and automated monthly EMI deduction.</p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="p-1 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Select Employee *</label>
                <select
                  value={form.employeeId || (employees.length > 0 ? employees[0].employeeId : 0)}
                  onChange={(e) => setForm({ ...form, employeeId: parseInt(e.target.value) || 0 })}
                  className="register-input w-full"
                  required
                >
                  {employees.length === 0 ? (
                    <option value={0}>No employees found for this branch</option>
                  ) : (
                    employees.map((e) => (
                      <option key={e.employeeId} value={e.employeeId}>
                        {e.employeeName} (#{e.employeeId})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Loan / Advance Type *</label>
                  <select
                    value={form.loanTypeId || (loanTypes.length > 0 ? loanTypes[0].id : 1)}
                    onChange={(e) => setForm({ ...form, loanTypeId: parseInt(e.target.value) || 1 })}
                    className="register-input w-full"
                  >
                    {loanTypes.length === 0 ? (
                      <option value={1}>Salary Advance</option>
                    ) : (
                      loanTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Principal Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: parseFloat(e.target.value) || 0 })}
                    className="register-input w-full font-data"
                    min={1000}
                    step={500}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Repayment Tenure (Months) *</label>
                  <input
                    type="number"
                    value={form.tenureMonths}
                    onChange={(e) => setForm({ ...form, tenureMonths: parseInt(e.target.value) || 1 })}
                    className="register-input w-full font-data"
                    min={1}
                    max={60}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Deduction Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="register-input w-full font-data"
                    required
                  />
                </div>
              </div>

              {/* Calculated EMI preview */}
              <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between text-xs">
                <span className="text-[var(--ink-muted)]">Calculated Monthly EMI:</span>
                <span className="text-sm font-bold font-data text-[var(--gold-500)]">
                  ₹{Math.round(form.principalAmount / (form.tenureMonths || 1)).toLocaleString()} / month
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Purpose / Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="State the purpose of loan application (e.g. Medical emergency, housing advance)..."
                  rows={3}
                  className="register-input w-full"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5b. Edit Loan Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  Edit Loan
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                  Update Application
                </h2>
                <p className="text-xs text-[var(--ink-muted)]">Modify loan details before approval.</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Loan / Advance Type *</label>
                  <select
                    value={form.loanTypeId}
                    onChange={(e) => setForm({ ...form, loanTypeId: parseInt(e.target.value) || 1 })}
                    className="register-input w-full"
                  >
                    {loanTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Principal Amount (₹) *</label>
                  <input
                    type="number"
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: parseFloat(e.target.value) || 0 })}
                    className="register-input w-full font-data"
                    min={1000}
                    step={500}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Repayment Tenure (Months) *</label>
                  <input
                    type="number"
                    value={form.tenureMonths}
                    onChange={(e) => setForm({ ...form, tenureMonths: parseInt(e.target.value) || 1 })}
                    className="register-input w-full font-data"
                    min={1}
                    max={60}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Deduction Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="register-input w-full font-data"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between text-xs">
                <span className="text-[var(--ink-muted)]">Calculated Monthly EMI:</span>
                <span className="text-sm font-bold font-data text-[var(--gold-500)]">
                  ₹{Math.round(form.principalAmount / (form.tenureMonths || 1)).toLocaleString()} / month
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Purpose / Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="State the purpose of loan application..."
                  rows={3}
                  className="register-input w-full"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-display font-bold text-base text-[var(--err-600)] flex items-center gap-1.5">
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
              className="register-input w-full text-xs"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--rule)]">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="btn-outline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="bg-[var(--err-600)] hover:opacity-90 text-white font-semibold py-1.5 px-3.5 rounded-[4px] text-xs cursor-pointer"
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

      {/* 8. Loan Prefix Setup Modal */}
      {prefixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-display font-semibold text-sm text-[var(--ink)]">
                  Loan Application # Prefix Setup
                </h3>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Configure how loan application numbers are generated for {currentBranch?.name || 'this workspace'}.
                </p>
              </div>
              <button
                onClick={() => setPrefixModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrefixSettings} className="space-y-4 text-xs">
              {/* Series Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Series Code *</label>
                  <input
                    type="text"
                    required
                    value={prefixForm.seriesCode}
                    onChange={(e) =>
                      setPrefixForm({ ...prefixForm, seriesCode: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. LN, ADV, LOAN"
                    className="register-input w-full font-mono text-xs font-bold uppercase tracking-wider"
                  />
                  <span className="text-[10px] text-[var(--ink-muted)] block mt-0.5">e.g. LN, ADV, LOAN</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Connector</label>
                  <input
                    type="text"
                    value={prefixForm.connector}
                    onChange={(e) => setPrefixForm({ ...prefixForm, connector: e.target.value })}
                    placeholder="e.g. -, #, /"
                    className="register-input w-full font-mono text-xs font-bold text-center"
                  />
                  <div className="flex items-center gap-1 mt-1">
                    {['-', '#', '/', '_', '.'].map((sym) => (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => setPrefixForm({ ...prefixForm, connector: sym })}
                        className={`px-1.5 py-0.5 rounded-[2px] border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                          prefixForm.connector === sym
                            ? 'bg-[var(--gold-500)] text-[var(--navy-900)] border-[var(--gold-500)]'
                            : 'bg-[var(--paper)] border-[var(--rule)] text-[var(--ink)] hover:border-[var(--gold-500)]'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPrefixForm({ ...prefixForm, connector: '' })}
                      className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-ui cursor-pointer transition-colors ${
                        prefixForm.connector === ''
                          ? 'bg-[var(--gold-500)] text-[var(--navy-900)] border-[var(--gold-500)]'
                          : 'bg-[var(--paper)] border-[var(--rule)] text-[var(--ink-muted)]'
                      }`}
                    >
                      none
                    </button>
                  </div>
                </div>
              </div>

              {/* Padding & Start Sequence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Padding Digits</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={prefixForm.paddingDigits}
                    onChange={(e) =>
                      setPrefixForm({
                        ...prefixForm,
                        paddingDigits: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="register-input w-full font-data text-center"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {[
                      { len: 3, label: '001' },
                      { len: 4, label: '0001' },
                      { len: 5, label: '00001' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.len}
                        onClick={() => setPrefixForm({ ...prefixForm, paddingDigits: item.len })}
                        className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-mono cursor-pointer transition-colors ${
                          prefixForm.paddingDigits === item.len
                            ? 'bg-[var(--gold-500)] text-[var(--navy-900)] border-[var(--gold-500)] font-bold'
                            : 'bg-[var(--paper)] border-[var(--rule)] text-[var(--ink)] hover:border-[var(--gold-500)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Start Sequence</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={prefixForm.startSequence}
                    onChange={(e) =>
                      setPrefixForm({ ...prefixForm, startSequence: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="register-input w-full font-data text-center"
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--ink-muted)]">Next Generated #:</span>
                  <span className="font-mono text-base font-bold text-[var(--gold-500)] tracking-wide">
                    {prefixForm.seriesCode || 'LN'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)] font-data">
                  <span>Series Samples:</span>
                  <span className="font-bold text-[var(--ink)]">
                    {prefixForm.seriesCode || 'LN'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'LN'}{prefixForm.connector}{String(prefixForm.startSequence + 1).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'LN'}{prefixForm.connector}{String(prefixForm.startSequence + 2).padStart(prefixForm.paddingDigits, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setPrefixModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrefix}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {savingPrefix ? 'Saving...' : 'Save Prefix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

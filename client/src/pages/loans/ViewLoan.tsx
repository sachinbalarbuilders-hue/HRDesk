import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Clock,
  IndianRupee,
  CalendarDays,
  User,
  Building2,
  FileText,
  XCircle,
} from 'lucide-react';

interface LoanDetail {
  id: number;
  applicationNumber: string;
  applicationDate: string;
  employeeId: number;
  employeeName: string;
  department: string;
  loanType: string;
  loanTypeId: number;
  loanAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  remainingInstallments: number;
  remainingAmount: number;
  startDate: string;
  status: string;
  reason: string;
  assignedManagerId: number | null;
  managerApprovedBy: string;
  managerApprovedDate: string | null;
  approvedBy: string;
  approvedDate: string | null;
  foreclosureRemark: string;
  startingPaidInstallments: number;
  createdAt: string;
}

interface Installment {
  id: number;
  installmentNumber: number;
  dueMonth: string;
  amount: number;
  paidAmount: number;
  status: string;
  paidDate: string | null;
  payrollId: number | null;
  remarks: string;
}

interface Summary {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  totalCount: number;
}

const StepNode: React.FC<{
  label: string;
  sublabel?: string;
  person?: string;
  isCompleted: boolean;
  isActive?: boolean;
  isRejected?: boolean;
}> = ({ label, sublabel, person, isCompleted, isActive, isRejected }) => {
  const dotClass = isRejected
    ? 'w-8 h-8 rounded-full border-2 border-[var(--err-600)] bg-[var(--err-600)] flex items-center justify-center'
    : isCompleted
    ? 'w-8 h-8 rounded-full border-2 border-[var(--ok-600)] bg-[var(--ok-600)] flex items-center justify-center'
    : isActive
    ? 'w-8 h-8 rounded-full border-2 border-[var(--gold-500)] bg-[var(--surface)] flex items-center justify-center animate-pulse'
    : 'w-8 h-8 rounded-full border-2 border-[var(--rule)] bg-[var(--surface)] flex items-center justify-center';

  return (
    <div className="flex flex-col items-center text-center z-10 flex-1">
      <div className={dotClass}>
        {isRejected && <XCircle size={14} className="text-white" />}
        {isCompleted && !isRejected && <CheckCircle size={14} className="text-white" />}
        {isActive && !isCompleted && !isRejected && <span className="w-2 h-2 rounded-full bg-[var(--gold-500)]" />}
      </div>
      <span className="text-[11px] font-semibold text-[var(--ink)] mt-2">{label}</span>
      {person && <span className="text-[10px] text-[var(--ink-muted)] mt-0.5">{person}</span>}
      {sublabel && <span className="text-[10px] font-data text-[var(--ink-muted)]">{sublabel}</span>}
    </div>
  );
};

export const ViewLoan: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const { hasPermission, isAdmin } = useAuth();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Foreclosure
  const [foreclosureOpen, setForeclosureOpen] = useState(false);
  const [foreclosureRemark, setForeclosureRemark] = useState('');
  const [includeCurrentMonth, setIncludeCurrentMonth] = useState(true);
  const [foreclosing, setForeclosing] = useState(false);

  const canManage = isAdmin || hasPermission('Payroll.ManageLoans');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/loans/${id}/installments`);
        setLoan(res.data.loan);
        setInstallments(res.data.installments);
        setSummary(res.data.summary);
      } catch (err: any) {
        showError('Failed to load', err.response?.data?.message || 'Could not fetch loan details.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleForeclose = async () => {
    try {
      setForeclosing(true);
      await apiClient.post(`/loans/${id}/foreclose`, {
        remark: foreclosureRemark.trim() || 'Foreclosed',
        includeCurrentMonth,
      });
      showSuccess('Loan Foreclosed', 'All pending installments settled. Loan marked as Closed.');
      setForeclosureOpen(false);
      // Reload data
      const res = await apiClient.get(`/loans/${id}/installments`);
      setLoan(res.data.loan);
      setInstallments(res.data.installments);
      setSummary(res.data.summary);
    } catch (err: any) {
      showError('Foreclosure Failed', err.response?.data?.message || 'Server error');
    } finally {
      setForeclosing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-2">
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="p-8 text-center text-sm text-[var(--ink-muted)]">
        Loan not found or access denied.
      </div>
    );
  }

  const progressPercent = summary ? Math.round((summary.paidCount / (summary.totalCount || 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/loans')}
            className="p-1.5 rounded-[4px] hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] cursor-pointer"
            title="Back to Loans"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
              Loan Details & Payment Summary
            </span>
            <h1 className="font-display text-2xl font-bold text-[var(--ink)] mt-0.5">
              {loan.applicationNumber}
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              {loan.employeeName} &middot; {loan.department} &middot; {loan.loanType}
            </p>
          </div>
        </div>

        {canManage && (loan.status === 'Disbursed' || loan.status === 'Active') && (
          <button
            onClick={() => { setForeclosureRemark(''); setIncludeCurrentMonth(true); setForeclosureOpen(true); }}
            className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold cursor-pointer border-[var(--err-600)] text-[var(--err-600)] hover:bg-[var(--err-600)] hover:text-white"
          >
            <XCircle size={14} />
            Foreclose Loan
          </button>
        )}
      </div>

      {/* Approval Flow Stepper */}
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-5">
        <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-5">
          Approval Flow
        </h3>
        <div className="flex items-start justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-[var(--rule)]" />

          {/* Step 1: Applied */}
          <StepNode
            label="Applied"
            sublabel={loan.applicationDate}
            person={loan.employeeName}
            isCompleted={true}
            isActive={loan.status === 'Pending'}
          />

          {/* Step 2: Manager Approval */}
          <StepNode
            label="Manager"
            sublabel={loan.managerApprovedDate || undefined}
            person={loan.managerApprovedBy || undefined}
            isCompleted={['Manager Approved', 'Approved', 'Disbursed', 'Closed'].includes(loan.status)}
            isActive={loan.status === 'Pending'}
            isRejected={loan.status === 'Rejected' && !loan.managerApprovedBy}
          />

          {/* Step 3: HR/Admin Approval */}
          <StepNode
            label="HR / Admin"
            sublabel={loan.approvedDate || undefined}
            person={loan.approvedBy || undefined}
            isCompleted={['Approved', 'Disbursed', 'Closed'].includes(loan.status)}
            isActive={loan.status === 'Manager Approved'}
            isRejected={loan.status === 'Rejected' && !!loan.managerApprovedBy}
          />

          {/* Step 4: Disbursed */}
          <StepNode
            label="Disbursed"
            sublabel={['Disbursed', 'Closed'].includes(loan.status) ? '✓' : undefined}
            isCompleted={['Disbursed', 'Closed'].includes(loan.status)}
            isActive={loan.status === 'Approved'}
          />

          {/* Step 5: Closed */}
          <StepNode
            label="Closed"
            sublabel={loan.status === 'Closed' ? '✓' : undefined}
            isCompleted={loan.status === 'Closed'}
            isActive={loan.status === 'Disbursed'}
          />
        </div>
      </div>

      {/* Loan Info Grid */}
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-5">
        <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText size={14} className="text-[var(--gold-500)]" />
          Application Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-xs">
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Application #</span>
            <span className="font-data font-bold text-[var(--ink)]">{loan.applicationNumber}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Application Date</span>
            <span className="font-data text-[var(--ink)]">{loan.applicationDate}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Employee</span>
            <span className="font-semibold text-[var(--ink)] flex items-center gap-1">
              <User size={12} /> {loan.employeeName} (#{loan.employeeId})
            </span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Department</span>
            <span className="text-[var(--ink)] flex items-center gap-1">
              <Building2 size={12} /> {loan.department}
            </span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Loan Type</span>
            <span className="font-semibold text-[var(--ink)]">{loan.loanType}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Principal Amount</span>
            <span className="font-data font-bold text-[var(--ink)]">₹{loan.loanAmount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Monthly EMI</span>
            <span className="font-data font-bold text-[var(--ink)]">₹{loan.installmentAmount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Tenure</span>
            <span className="font-data text-[var(--ink)]">{loan.totalInstallments} months</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">EMI Start Date</span>
            <span className="font-data text-[var(--ink)]">{loan.startDate}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Status</span>
            <span className={`font-semibold ${
              loan.status === 'Disbursed' ? 'text-[var(--ok-600)]' :
              loan.status === 'Pending' ? 'text-[var(--warn-600)]' :
              loan.status === 'Rejected' ? 'text-[var(--err-600)]' :
              'text-[var(--ink)]'
            }`}>{loan.status}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Remaining Amount</span>
            <span className="font-data font-bold text-[var(--warn-600)]">₹{loan.remainingAmount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Remaining EMIs</span>
            <span className="font-data text-[var(--ink)]">{loan.remainingInstallments}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[var(--ink-muted)] block mb-0.5">Purpose / Reason</span>
            <span className="text-[var(--ink)]">{loan.reason || '—'}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Manager Approved By</span>
            <span className="text-[var(--ink)]">{loan.managerApprovedBy || '—'}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Manager Approved Date</span>
            <span className="font-data text-[var(--ink)]">{loan.managerApprovedDate || '—'}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">HR/Admin Approved By</span>
            <span className="text-[var(--ink)]">{loan.approvedBy || '—'}</span>
          </div>
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">HR/Admin Approved Date</span>
            <span className="font-data text-[var(--ink)]">{loan.approvedDate || '—'}</span>
          </div>
          {loan.foreclosureRemark && (
            <div className="col-span-2">
              <span className="text-[var(--ink-muted)] block mb-0.5">Foreclosure Remark</span>
              <span className="text-[var(--ink)]">{loan.foreclosureRemark}</span>
            </div>
          )}
          {loan.startingPaidInstallments > 0 && (
            <div>
              <span className="text-[var(--ink-muted)] block mb-0.5">Pre-Migrated Paid EMIs</span>
              <span className="font-data text-[var(--ink)]">{loan.startingPaidInstallments}</span>
            </div>
          )}
          <div>
            <span className="text-[var(--ink-muted)] block mb-0.5">Created At</span>
            <span className="font-data text-[var(--ink-muted)]">{loan.createdAt}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
          <div className="flex items-center gap-2 text-[var(--ink-muted)] mb-1">
            <IndianRupee size={14} />
            <span className="text-[10px] uppercase font-semibold font-data">Loan Amount</span>
          </div>
          <div className="font-data text-lg font-bold text-[var(--ink)]">
            ₹{loan.loanAmount.toLocaleString()}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
          <div className="flex items-center gap-2 text-[var(--ink-muted)] mb-1">
            <CalendarDays size={14} />
            <span className="text-[10px] uppercase font-semibold font-data">Monthly EMI</span>
          </div>
          <div className="font-data text-lg font-bold text-[var(--ink)]">
            ₹{loan.installmentAmount.toLocaleString()}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
          <div className="flex items-center gap-2 text-[var(--ok-600)] mb-1">
            <CheckCircle size={14} />
            <span className="text-[10px] uppercase font-semibold font-data">Total Recovered</span>
          </div>
          <div className="font-data text-lg font-bold text-[var(--ok-600)]">
            ₹{summary?.totalPaid.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-[var(--ink-muted)] font-data mt-0.5">
            {summary?.paidCount} of {summary?.totalCount} EMIs
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
          <div className="flex items-center gap-2 text-[var(--warn-600)] mb-1">
            <Clock size={14} />
            <span className="text-[10px] uppercase font-semibold font-data">Outstanding</span>
          </div>
          <div className="font-data text-lg font-bold text-[var(--warn-600)]">
            ₹{loan.remainingAmount.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--ink-muted)] font-data mt-0.5">
            {loan.remainingInstallments} EMIs remaining
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--ink)]">Repayment Progress</span>
          <span className="font-data text-xs font-bold text-[var(--gold-500)]">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--rule)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--ok-600)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Installment Ledger Table */}
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] overflow-hidden">
        <div className="p-4 border-b border-[var(--rule)] bg-[var(--surface-header)]">
          <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={14} className="text-[var(--gold-500)]" />
            Installment Ledger
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--surface-header)] text-[var(--ink-muted)] font-data text-[11px] uppercase tracking-wider">
                <th className="p-3 font-semibold">#</th>
                <th className="p-3 font-semibold">Due Month</th>
                <th className="p-3 font-semibold">EMI Amount</th>
                <th className="p-3 font-semibold">Paid Amount</th>
                <th className="p-3 font-semibold">Paid Date</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Payroll ID</th>
                <th className="p-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {installments.map((inst) => (
                <tr key={inst.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="p-3 font-data font-bold text-[var(--ink)]">
                    {inst.installmentNumber}
                  </td>
                  <td className="p-3 font-data text-[var(--ink)]">
                    {inst.dueMonth}
                  </td>
                  <td className="p-3 font-data font-semibold text-[var(--ink)]">
                    ₹{inst.amount.toLocaleString()}
                  </td>
                  <td className="p-3 font-data font-semibold text-[var(--ok-600)]">
                    {inst.paidAmount > 0 ? `₹${inst.paidAmount.toLocaleString()}` : '—'}
                  </td>
                  <td className="p-3 font-data text-[var(--ink-muted)]">
                    {inst.paidDate || '—'}
                  </td>
                  <td className="p-3">
                    {inst.status === 'Paid' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        <CheckCircle size={10} /> Paid
                      </span>
                    )}
                    {inst.status === 'Settled' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        <CheckCircle size={10} /> Settled
                      </span>
                    )}
                    {inst.status === 'Pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <Clock size={10} /> Pending
                      </span>
                    )}
                    {!['Paid', 'Settled', 'Pending'].includes(inst.status) && (
                      <span className="text-[10px] text-[var(--ink-muted)]">{inst.status}</span>
                    )}
                  </td>
                  <td className="p-3 font-data text-[var(--ink-muted)]">
                    {inst.payrollId ? `#${inst.payrollId}` : '—'}
                  </td>
                  <td className="p-3 text-[var(--ink-muted)] max-w-[160px] truncate" title={inst.remarks}>
                    {inst.remarks || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Foreclosure Modal */}
      {foreclosureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-display font-bold text-base text-[var(--err-600)] flex items-center gap-1.5">
              <XCircle size={18} /> Foreclose Loan
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              This will settle all pending installments and mark the loan as Closed. This action cannot be undone.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Foreclosure Remark *</label>
              <textarea
                value={foreclosureRemark}
                onChange={(e) => setForeclosureRemark(e.target.value)}
                placeholder="e.g. Employee resigned / Lump-sum repayment received..."
                rows={3}
                className="register-input w-full text-xs"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
              <input
                type="checkbox"
                checked={includeCurrentMonth}
                onChange={(e) => setIncludeCurrentMonth(e.target.checked)}
                className="rounded border-[var(--rule)]"
              />
              Include current month's pending EMI in settlement
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
              <button
                type="button"
                onClick={() => setForeclosureOpen(false)}
                className="btn-outline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForeclose}
                disabled={foreclosing || !foreclosureRemark.trim()}
                className="bg-[var(--err-600)] hover:opacity-90 text-white font-semibold py-1.5 px-3.5 rounded-[4px] text-xs cursor-pointer disabled:opacity-50"
              >
                {foreclosing ? 'Processing...' : 'Confirm Foreclosure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

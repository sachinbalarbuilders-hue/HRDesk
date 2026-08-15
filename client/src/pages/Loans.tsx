import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import {
  DollarSign,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  CreditCard,
  Receipt,
  TrendingDown,
} from 'lucide-react';

interface LoanRecord {
  id: number;
  appNumber: string;
  appDate: string;
  employeeId: number;
  employeeName: string;
  department: string;
  loanType: 'Salary Advance' | 'Personal Loan' | 'Emergency Aid' | 'Equipment Loan';
  principalAmount: number;
  monthlyEmi: number;
  tenureMonths: number;
  paidMonths: number;
  remainingAmount: number;
  startMonth: string;
  status: 'Pending' | 'Approved' | 'Disbursed' | 'Closed' | 'Rejected';
  reason: string;
}

export const Loans: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form, setForm] = useState({
    employeeName: '',
    employeeId: '',
    department: 'Engineering & Technology',
    loanType: 'Salary Advance' as const,
    principalAmount: 25000,
    tenureMonths: 5,
    startMonth: '2026-09',
    reason: '',
  });

  const [loans, setLoans] = useState<LoanRecord[]>([
    {
      id: 1,
      appNumber: 'LN-2026-001',
      appDate: '2026-07-15',
      employeeId: 1042,
      employeeName: 'Ramesh Patel',
      department: 'Engineering & Technology',
      loanType: 'Personal Loan',
      principalAmount: 100000,
      monthlyEmi: 10000,
      tenureMonths: 10,
      paidMonths: 4,
      remainingAmount: 60000,
      startMonth: '2026-08',
      status: 'Disbursed',
      reason: 'Home renovation expenses',
    },
    {
      id: 2,
      appNumber: 'LN-2026-002',
      appDate: '2026-08-01',
      employeeId: 1089,
      employeeName: 'Priya Sharma',
      department: 'Human Resources & People',
      loanType: 'Salary Advance',
      principalAmount: 30000,
      monthlyEmi: 10000,
      tenureMonths: 3,
      paidMonths: 1,
      remainingAmount: 20000,
      startMonth: '2026-08',
      status: 'Disbursed',
      reason: 'Family emergency advance',
    },
    {
      id: 3,
      appNumber: 'LN-2026-003',
      appDate: '2026-08-10',
      employeeId: 1104,
      employeeName: 'Anil Kumar',
      department: 'Operations & Logistics',
      loanType: 'Emergency Aid',
      principalAmount: 15000,
      monthlyEmi: 5000,
      tenureMonths: 3,
      paidMonths: 0,
      remainingAmount: 15000,
      startMonth: '2026-09',
      status: 'Approved',
      reason: 'Medical prescription assistance',
    },
    {
      id: 4,
      appNumber: 'LN-2026-004',
      appDate: '2026-08-14',
      employeeId: 1120,
      employeeName: 'Vikram Mehta',
      department: 'Finance & Accounts',
      loanType: 'Equipment Loan',
      principalAmount: 50000,
      monthlyEmi: 5000,
      tenureMonths: 10,
      paidMonths: 0,
      remainingAmount: 50000,
      startMonth: '2026-09',
      status: 'Pending',
      reason: 'Workstation laptop upgrade',
    },
  ]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeName.trim()) {
      showError('Validation Error', 'Employee name is required.');
      return;
    }

    const emi = Math.round(form.principalAmount / (form.tenureMonths || 1));
    const newRecord: LoanRecord = {
      id: Date.now(),
      appNumber: `LN-2026-${String(loans.length + 1).padStart(3, '0')}`,
      appDate: new Date().toISOString().split('T')[0],
      employeeId: Number(form.employeeId) || 1000 + loans.length + 1,
      employeeName: form.employeeName,
      department: form.department,
      loanType: form.loanType,
      principalAmount: Number(form.principalAmount),
      monthlyEmi: emi,
      tenureMonths: Number(form.tenureMonths),
      paidMonths: 0,
      remainingAmount: Number(form.principalAmount),
      startMonth: form.startMonth,
      status: 'Pending',
      reason: form.reason,
    };

    setLoans([newRecord, ...loans]);
    showSuccess('Application Filed', `Loan application ${newRecord.appNumber} submitted for approval.`);
    setApplyModalOpen(false);
    setForm({
      employeeName: '',
      employeeId: '',
      department: 'Engineering & Technology',
      loanType: 'Salary Advance',
      principalAmount: 25000,
      tenureMonths: 5,
      startMonth: '2026-09',
      reason: '',
    });
  };

  const handleStatusChange = (id: number, newStatus: LoanRecord['status']) => {
    setLoans(loans.map(l => l.id === id ? { ...l, status: newStatus } : l));
    showSuccess('Status Updated', `Loan record status changed to ${newStatus}.`);
  };

  const handleDelete = (id: number) => {
    setLoans(loans.filter(l => l.id !== id));
    showSuccess('Record Removed', 'Loan application deleted.');
  };

  const handleExport = () => {
    const headers = [
      { key: 'appNumber', label: 'App Number' },
      { key: 'appDate', label: 'Application Date' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'loanType', label: 'Loan Type' },
      { key: 'principalAmount', label: 'Principal Amount' },
      { key: 'monthlyEmi', label: 'Monthly EMI' },
      { key: 'remainingAmount', label: 'Outstanding Balance' },
      { key: 'status', label: 'Status' },
    ];
    exportToCSV('HRDesk_Loans_and_Advances', filteredLoans, headers);
    showSuccess('Data Exported', 'Loan applications downloaded to CSV.');
  };

  // Metrics Calculations
  const totalDisbursed = loans.filter(l => l.status === 'Disbursed' || l.status === 'Closed').reduce((acc, l) => acc + l.principalAmount, 0);
  const totalOutstanding = loans.filter(l => l.status === 'Disbursed' || l.status === 'Approved').reduce((acc, l) => acc + l.remainingAmount, 0);
  const totalRecovered = totalDisbursed - totalOutstanding;

  const filteredLoans = loans.filter((l) => {
    const matchesSearch = !search ||
      l.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      l.appNumber.toLowerCase().includes(search.toLowerCase()) ||
      l.employeeId.toString().includes(search);
    const matchesStatus = !statusFilter || l.status === statusFilter;
    const matchesType = !typeFilter || l.loanType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalCount = filteredLoans.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedLoans = filteredLoans.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Loans & Advances
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Employee loan requests, salary advance ledgers & payroll EMI deductions
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {filteredLoans.length} Applications on Record
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Financial Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>Total Applications</span>
            <Receipt size={14} className="text-[var(--gold-500)]" />
          </div>
          <p className="font-display text-xl font-bold text-[var(--ink)]">{loans.length}</p>
          <p className="text-[10px] text-[var(--ink-muted)] font-data">
            {loans.filter(l => l.status === 'Pending').length} Pending Approval
          </p>
        </div>

        <div className="p-4 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>Total Disbursed</span>
            <CreditCard size={14} className="text-[var(--ok-600)]" />
          </div>
          <p className="font-data text-xl font-bold text-[var(--ok-600)]">₹{totalDisbursed.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-[var(--ink-muted)] font-data">Cumulative approved advances</p>
        </div>

        <div className="p-4 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>Total Recovered</span>
            <TrendingDown size={14} className="text-[var(--gold-500)]" />
          </div>
          <p className="font-data text-xl font-bold text-[var(--ink)]">₹{Math.max(0, totalRecovered).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-[var(--ink-muted)] font-data">Via monthly salary deductions</p>
        </div>

        <div className="p-4 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>Outstanding Balance</span>
            <DollarSign size={14} className="text-[var(--warn-600)]" />
          </div>
          <p className="font-data text-xl font-bold text-[var(--warn-600)]">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-[var(--ink-muted)] font-data">Pending future recoveries</p>
        </div>
      </div>

      {/* 3. Unified DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search loans by employee, app # or record ID..."
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Approved', label: 'Approved' },
              { value: 'Disbursed', label: 'Disbursed' },
              { value: 'Closed', label: 'Closed' },
              { value: 'Rejected', label: 'Rejected' },
            ],
          },
          {
            id: 'type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: '', label: 'All Loan Types' },
              { value: 'Salary Advance', label: 'Salary Advance' },
              { value: 'Personal Loan', label: 'Personal Loan' },
              { value: 'Emergency Aid', label: 'Emergency Aid' },
              { value: 'Equipment Loan', label: 'Equipment Loan' },
            ],
          },
        ]}
        onExport={handleExport}
        exportLabel="Export Loans"
        onImport={() => setImportModalOpen(true)}
        importLabel="Import CSV"
        primaryAction={{
          label: 'Apply for Loan',
          icon: <Plus size={14} />,
          onClick: () => setApplyModalOpen(true),
        }}
      />

      {/* 4. Ruled Ledger Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <table className="register-table">
          <thead>
            <tr>
              <th className="font-data">App #</th>
              <th>Employee Member</th>
              <th>Category</th>
              <th className="text-right font-data">Principal</th>
              <th className="text-right font-data">Monthly EMI</th>
              <th className="text-center font-data">Tenure</th>
              <th className="text-right font-data">Remaining</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLoans.map((l) => {
              const statusColors: Record<string, string> = {
                Pending: 'bg-[var(--warn-600)]/10 text-[var(--warn-600)] border border-[var(--warn-600)]/30',
                Approved: 'bg-[var(--gold-100)] text-[var(--gold-500)] border border-[var(--gold-500)]/30',
                Disbursed: 'bg-[var(--ok-600)]/10 text-[var(--ok-600)] border border-[var(--ok-600)]/30',
                Closed: 'bg-[var(--paper)] text-[var(--ink-muted)] border border-[var(--rule)]',
                Rejected: 'bg-[var(--err-600)]/10 text-[var(--err-600)] border border-[var(--err-600)]/30',
              };

              return (
                <tr key={l.id}>
                  {/* App # */}
                  <td className="font-data text-xs font-semibold text-[var(--ink)]">
                    {l.appNumber}
                    <span className="block text-[10px] font-normal text-[var(--ink-muted)] font-data">{l.appDate}</span>
                  </td>

                  {/* Employee */}
                  <td>
                    <p className="font-semibold text-xs text-[var(--ink)] font-ui">{l.employeeName}</p>
                    <p className="text-[10px] text-[var(--ink-muted)] font-data">#{l.employeeId} · {l.department}</p>
                  </td>

                  {/* Loan Type */}
                  <td className="text-xs text-[var(--ink)] font-semibold">
                    {l.loanType}
                  </td>

                  {/* Principal */}
                  <td className="text-right font-data text-xs text-[var(--ink)] font-bold">
                    ₹{l.principalAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Monthly EMI */}
                  <td className="text-right font-data text-xs text-[var(--ink-muted)]">
                    ₹{l.monthlyEmi.toLocaleString('en-IN')} / mo
                  </td>

                  {/* Tenure / Progress */}
                  <td className="text-center font-data text-xs text-[var(--ink)]">
                    <span>{l.paidMonths} / {l.tenureMonths} mos</span>
                  </td>

                  {/* Remaining Balance */}
                  <td className="text-right font-data text-xs text-[var(--ink)] font-bold">
                    ₹{l.remainingAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Status Badge */}
                  <td>
                    <span className={`px-2 py-0.5 rounded-[2px] font-data text-[10px] font-bold inline-block ${statusColors[l.status]}`}>
                      {l.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {l.status === 'Pending' && (
                        <button
                          onClick={() => handleStatusChange(l.id, 'Approved')}
                          className="p-1 text-[var(--ok-600)] hover:bg-[var(--ok-600)]/10 rounded cursor-pointer"
                          title="Approve Loan"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}

                      {l.status === 'Approved' && (
                        <button
                          onClick={() => handleStatusChange(l.id, 'Disbursed')}
                          className="p-1 text-[var(--gold-500)] hover:bg-[var(--gold-100)]/30 rounded cursor-pointer font-data text-[10px] font-bold"
                          title="Disburse Funds"
                        >
                          Disburse
                        </button>
                      )}

                      {l.status === 'Pending' && (
                        <button
                          onClick={() => handleStatusChange(l.id, 'Rejected')}
                          className="p-1 text-[var(--err-600)] hover:bg-[var(--err-600)]/10 rounded cursor-pointer"
                          title="Reject Loan"
                        >
                          <XCircle size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(l.id)}
                        className="p-1 text-[var(--ink-muted)] hover:text-[var(--err-600)] cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedLoans.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                  No loan or advance applications match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Ruled Pagination Toolbar */}
        <PaginationToolbar
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>

      {/* 5. Apply for Loan Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Apply for Loan / Advance
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Submit loan request for review & salary deduction setup</p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApply} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.employeeName}
                    onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="register-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Employee ID
                  </label>
                  <input
                    type="number"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="1042"
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="Engineering & Technology">Engineering & Technology</option>
                    <option value="Human Resources & People">Human Resources & People</option>
                    <option value="Operations & Logistics">Operations & Logistics</option>
                    <option value="Finance & Accounts">Finance & Accounts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Advance Category *
                  </label>
                  <select
                    value={form.loanType}
                    onChange={(e) => setForm({ ...form, loanType: e.target.value as any })}
                    className="register-input w-full"
                  >
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Personal Loan">Personal Loan</option>
                    <option value="Emergency Aid">Emergency Aid</option>
                    <option value="Equipment Loan">Equipment Loan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: Number(e.target.value) })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Tenure (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    required
                    value={form.tenureMonths}
                    onChange={(e) => setForm({ ...form, tenureMonths: Number(e.target.value) })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Deduction Start
                  </label>
                  <input
                    type="month"
                    required
                    value={form.startMonth}
                    onChange={(e) => setForm({ ...form, startMonth: e.target.value })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
              </div>

              {/* Monthly EMI Estimator */}
              <div className="p-3 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] flex items-center justify-between text-xs">
                <span className="text-[var(--ink-muted)]">Calculated Monthly EMI:</span>
                <span className="font-data font-bold text-[var(--ink)]">
                  ₹{Math.round(form.principalAmount / (form.tenureMonths || 1)).toLocaleString('en-IN')} / month
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Reason / Justification
                </label>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Purpose of the loan or salary advance request"
                  className="register-input w-full"
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
                  className="btn-primary cursor-pointer"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Loans & Advances"
        templateFilename="HRDesk_Loans_Template"
        templateHeaders={['EmployeeId', 'LoanType', 'PrincipalAmount', 'TenureMonths', 'StartMonth', 'Reason']}
        templateSampleRow={['1042', 'Salary Advance', '25000', '5', '2026-09', 'Emergency Advance']}
        onImportComplete={() => {
          setImportModalOpen(false);
          showSuccess('Loans Imported', 'Advance records updated from CSV.');
        }}
      />
    </div>
  );
};

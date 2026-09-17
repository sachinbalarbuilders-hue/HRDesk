import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { TaxDeclarationModal } from '../../components/payroll/TaxDeclarationModal';
import { Form16Modal } from '../../components/payroll/Form16Modal';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import {
  Search,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const TaxDeclarationsTab: React.FC = () => {
  const { showError, showSuccess } = useToast();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultFy = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

  const [financialYear, setFinancialYear] = useState(defaultFy);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | undefined>();

  const [loading, setLoading] = useState(true);
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const [metrics, setMetrics] = useState({
    total: 0,
    approved: 0,
    submitted: 0,
    draft: 0,
    notStarted: 0,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form16ModalOpen, setForm16ModalOpen] = useState(false);
  const [selectedForm16Emp, setSelectedForm16Emp] = useState<{ id: number; name: string } | null>(null);

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/masters/overview');
      if (res.data?.departments) {
        setDepartments(res.data.departments);
      }
    } catch {
      // Non-critical
    }
  };

  const fetchDeclarations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tax-declarations', {
        params: {
          financialYear,
          status: statusFilter,
          search: search || undefined,
          departmentId: selectedDept,
          page,
          pageSize,
        },
      });
      const data = res.data;
      if (data) {
        setDeclarations(data.data || []);
        setTotalCount(data.totalCount || 0);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch {
      showError('Error', 'Failed to load IT declarations list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchDeclarations();
  }, [financialYear, statusFilter, selectedDept, page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDeclarations();
  };

  const openDeclaration = (employeeId: number) => {
    setSelectedEmployeeId(employeeId);
    setIsModalOpen(true);
  };

  const exportCsv = async () => {
    try {
      const res = await apiClient.get('/tax-declarations', {
        params: {
          financialYear,
          status: statusFilter,
          search: search || undefined,
          departmentId: selectedDept,
          page: 1,
          pageSize: 5000,
        },
      });
      const allRows = res.data?.data || declarations;
      if (!allRows.length) {
        showError('Export Empty', 'No declaration records found to export.');
        return;
      }
      const headers = ['Employee ID', 'Employee Code', 'Employee Name', 'Department', 'Designation', 'Annual CTC', 'Regime', '80C Declared', 'Rent Paid', 'Home Loan Int', 'Status'];
      const rows = allRows.map((d: any) => [
        d.employeeId,
        d.employeeCode,
        `"${d.fullName}"`,
        `"${d.departmentName || ''}"`,
        `"${d.designationName || ''}"`,
        d.annualCTC || 0,
        d.taxRegime,
        d.total80CDeclared || 0,
        d.annualRentPaid || 0,
        d.homeLoanInterest || 0,
        d.status,
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `IT_Declarations_${financialYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('Export Complete', 'IT declarations exported to CSV.');
    } catch {
      showError('Export Failed', 'Failed to export declarations to CSV.');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div>
          <div className="font-semibold text-xs text-[var(--text-primary)]">{row.fullName}</div>
          <div className="text-xs font-normal  text-[var(--text-muted)]">{row.employeeCode}</div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Role',
      render: (row) => (
        <div>
          <div className="text-xs text-[var(--text-primary)]">{row.departmentName || '—'}</div>
          <div className="text-xs font-normal text-[var(--text-muted)]">{row.designationName || '—'}</div>
        </div>
      ),
    },
    {
      key: 'annualCTC',
      header: 'Annual CTC',
      align: 'right',
      render: (row) => (
        <span className=" text-xs font-semibold text-[var(--text-primary)]">
          {formatCurrency(row.annualCTC)}
        </span>
      ),
    },
    {
      key: 'taxRegime',
      header: 'Tax Regime',
      align: 'center',
      render: (row) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-normal font-medium  ${
            row.taxRegime === 'Old'
              ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
              : 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/30'
          }`}
        >
          {row.taxRegime === 'Old' ? 'Old Regime' : 'New (115BAC)'}
        </span>
      ),
    },
    {
      key: 'total80C',
      header: '80C Declared',
      align: 'right',
      render: (row) => (
        <span className={` text-xs ${row.total80CDeclared > 0 ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {formatCurrency(row.total80CDeclared)}
        </span>
      ),
    },
    {
      key: 'rentSec24',
      header: 'Rent / Sec 24',
      align: 'right',
      render: (row) => (
        <div className="text-right  text-xs">
          <div className={row.annualRentPaid > 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}>
            Rent: {formatCurrency(row.annualRentPaid)}
          </div>
          {row.homeLoanInterest > 0 && (
            <div className="text-xs font-normal text-[var(--success)] font-medium">
              Int: {formatCurrency(row.homeLoanInterest)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        const isApproved = row.status === 'Approved';
        const isSubmitted = row.status === 'Submitted';
        const isRejected = row.status === 'Rejected';

        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal font-medium ${
              isApproved
                ? 'bg-[var(--success-light)] text-[var(--success)]'
                : isSubmitted
                ? 'bg-[var(--warning-light)] text-[var(--warning)]'
                : isRejected
                ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border)]'
            }`}
          >
            {isApproved && <CheckCircle2 size={11} />}
            {isSubmitted && <Clock size={11} />}
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedForm16Emp({ id: row.employeeId, name: row.fullName });
              setForm16ModalOpen(true);
            }}
            className="btn-secondary py-1 px-2 text-xs flex items-center gap-1 cursor-pointer"
            title="Generate & View Form 16 (Part B)"
          >
            <FileText size={11} className="text-[var(--accent)]" /> Form 16
          </button>
          <button
            type="button"
            onClick={() => openDeclaration(row.employeeId)}
            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 cursor-pointer"
          >
            Review & Compute <ChevronRight size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 ">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Financial Year:</span>
            <select
              value={financialYear}
              onChange={e => { setFinancialYear(e.target.value); setPage(1); }}
              className="register-input h-8 py-1 px-2.5 w-auto text-sm font-semibold  cursor-pointer"
            >
              <option value="2024-2025">FY 2024-2025</option>
              <option value="2025-2026">FY 2025-2026</option>
              <option value="2026-2027">FY 2026-2027</option>
              <option value="2027-2028">FY 2027-2028</option>
            </select>
          </div>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Department Filter */}
          <select
            value={selectedDept || ''}
            onChange={e => { setSelectedDept(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="register-input h-8 py-1 px-2.5 w-auto text-sm font-semibold cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="register-input h-8 pl-8 pr-3 py-1 text-xs w-48 focus:w-64 transition-all"
            />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </form>

          <button
            type="button"
            onClick={fetchDeclarations}
            title="Refresh List"
            className="p-1.5 rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="btn-secondary h-8 py-1 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs">
          <span className="text-xs font-normal uppercase tracking-wider font-semibold text-[var(--text-secondary)] block">Total Employees</span>
          <span className="text-base font-semibold  text-[var(--text-primary)] mt-1 block">{metrics.total}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs">
          <span className="text-xs font-normal uppercase tracking-wider font-semibold text-[var(--success)] block">Approved</span>
          <span className="text-base font-semibold  text-[var(--success)] mt-1 block">{metrics.approved}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs">
          <span className="text-xs font-normal uppercase tracking-wider font-semibold text-[var(--warning)] block">Submitted (Pending)</span>
          <span className="text-base font-semibold  text-[var(--warning)] mt-1 block">{metrics.submitted}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs">
          <span className="text-xs font-normal uppercase tracking-wider font-semibold text-[var(--text-muted)] block">Draft / Not Started</span>
          <span className="text-base font-semibold  text-[var(--text-primary)] mt-1 block">{metrics.draft + metrics.notStarted}</span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        {['All', 'Approved', 'Submitted', 'Draft', 'Not Started'].map(status => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                isActive
                  ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      {/* Standard Reusable DataTable with Skeleton Loading & Pagination */}
      <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={declarations}
          loading={loading}
          showSrNo={false}
          keyExtractor={(item) => item.employeeId}
          emptyMessage="No IT declarations found matching your filter criteria."
          pagination={{
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize) || 1,
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
          }}
        />
      </div>

      {/* Interactive Modal */}
      {selectedEmployeeId && (
        <TaxDeclarationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmployeeId(null);
          }}
          employeeId={selectedEmployeeId}
          financialYear={financialYear}
          onSaved={fetchDeclarations}
        />
      )}

      {/* Form 16 Part B Document Modal */}
      {selectedForm16Emp && (
        <Form16Modal
          open={form16ModalOpen}
          onClose={() => {
            setForm16ModalOpen(false);
            setSelectedForm16Emp(null);
          }}
          employeeId={selectedForm16Emp.id}
          employeeName={selectedForm16Emp.name}
          initialFinancialYear={financialYear}
        />
      )}
    </div>
  );
};

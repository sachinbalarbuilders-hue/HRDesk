import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { TaxDeclarationModal } from '../../components/payroll/TaxDeclarationModal';
import {
  Calculator,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  FileText,
  Download,
  Sparkles,
  RefreshCw,
  Landmark,
  ChevronRight
} from 'lucide-react';

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
  const [metrics, setMetrics] = useState({
    total: 0,
    approved: 0,
    submitted: 0,
    draft: 0,
    notStarted: 0
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          departmentId: selectedDept
        }
      });
      const data = res.data;
      if (data) {
        setDeclarations(data.data || []);
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
  }, [financialYear, statusFilter, selectedDept]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeclarations();
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const openDeclaration = (employeeId: number) => {
    setSelectedEmployeeId(employeeId);
    setIsModalOpen(true);
  };

  const exportCsv = () => {
    if (!declarations.length) return;
    const headers = ['Employee ID', 'Employee Code', 'Employee Name', 'Department', 'Designation', 'Annual CTC', 'Regime', '80C Declared', 'Status'];
    const rows = declarations.map(d => [
      d.employeeId,
      d.employeeCode,
      `"${d.fullName}"`,
      `"${d.departmentName}"`,
      `"${d.designationName}"`,
      d.annualCTC,
      d.taxRegime,
      d.total80CDeclared,
      d.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IT_Declarations_${financialYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported', 'IT declarations list exported to CSV.');
  };

  return (
    <div className="space-y-5">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--ink)]">Financial Year:</span>
            <select
              value={financialYear}
              onChange={e => setFinancialYear(e.target.value)}
              className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-md text-xs font-medium font-data cursor-pointer"
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
            onChange={e => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-md text-xs font-medium cursor-pointer"
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
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-md w-48 focus:w-64 transition-all"
            />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          </form>

          <button
            type="button"
            onClick={fetchDeclarations}
            title="Refresh List"
            className="p-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-md hover:bg-[var(--surface-sunken)] text-[var(--ink)] flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-muted)] block">Total Employees</span>
          <span className="text-xl font-bold font-data text-[var(--ink)] mt-1 block">{metrics.total}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ok-600)] block">Approved</span>
          <span className="text-xl font-bold font-data text-[var(--ok-600)] mt-1 block">{metrics.approved}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--warn-600)] block">Submitted (Pending)</span>
          <span className="text-xl font-bold font-data text-[var(--warn-600)] mt-1 block">{metrics.submitted}</span>
        </div>
        <div className="bg-[var(--surface)] p-3.5 rounded-lg border border-[var(--border)]">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-muted)] block">Draft / Not Started</span>
          <span className="text-xl font-bold font-data text-[var(--ink-muted)] mt-1 block">{metrics.draft + metrics.notStarted}</span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        {['All', 'Approved', 'Submitted', 'Draft', 'Not Started'].map(status => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-all cursor-pointer ${
                isActive
                  ? 'border-[var(--gold-500)] text-[var(--gold-600)] font-semibold'
                  : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      {/* Declarations Register Table */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)] flex items-center justify-center gap-2 font-data">
            <RefreshCw size={16} className="animate-spin text-[var(--gold-500)]" /> Loading muster records...
          </div>
        ) : declarations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText size={32} className="mx-auto text-[var(--ink-muted)] opacity-50" />
            <p className="text-xs font-medium text-[var(--ink)]">No IT declarations found</p>
            <p className="text-[11px] text-[var(--ink-muted)]">Try selecting a different financial year or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--ink-muted)] font-medium">
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-3">Department & Role</th>
                  <th className="py-2.5 px-3 text-right">Annual CTC</th>
                  <th className="py-2.5 px-3 text-center">Tax Regime</th>
                  <th className="py-2.5 px-3 text-right">80C Declared</th>
                  <th className="py-2.5 px-3 text-right">Rent / Sec 24</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {declarations.map(row => {
                  const isApproved = row.status === 'Approved';
                  const isSubmitted = row.status === 'Submitted';

                  return (
                    <tr
                      key={row.employeeId}
                      className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      onClick={() => openDeclaration(row.employeeId)}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[var(--ink)]">{row.fullName}</div>
                        <div className="text-[10px] font-data text-[var(--ink-muted)]">{row.employeeCode}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[var(--ink)]">{row.departmentName}</div>
                        <div className="text-[10px] text-[var(--ink-muted)]">{row.designationName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-data font-medium text-[var(--ink)]">
                        {formatCurrency(row.annualCTC)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium font-data ${
                          row.taxRegime === 'Old'
                            ? 'bg-[var(--navy-900)] text-white'
                            : 'bg-[var(--gold-500)]/15 text-[var(--gold-700)] border border-[var(--gold-500)]/30'
                        }`}>
                          {row.taxRegime === 'Old' ? 'Old Regime' : 'New (115BAC)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-data">
                        <span className={row.total80CDeclared > 0 ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-muted)]'}>
                          {formatCurrency(row.total80CDeclared)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-data">
                        <div className={row.annualRentPaid > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}>
                          Rent: {formatCurrency(row.annualRentPaid)}
                        </div>
                        {row.homeLoanInterest > 0 && (
                          <div className="text-[10px] text-[var(--ok-600)]">
                            Int: {formatCurrency(row.homeLoanInterest)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium font-data ${
                          isApproved ? 'bg-[var(--ok-600)]/15 text-[var(--ok-600)]' :
                          isSubmitted ? 'bg-[var(--warn-600)]/15 text-[var(--warn-600)]' :
                          row.status === 'Rejected' ? 'bg-[var(--err-600)]/15 text-[var(--err-600)]' :
                          'bg-[var(--rule)]/50 text-[var(--ink-muted)]'
                        }`}>
                          {isApproved && <CheckCircle2 size={11} />}
                          {isSubmitted && <Clock size={11} />}
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeclaration(row.employeeId);
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--border)] hover:bg-[var(--surface-sunken)] text-[var(--ink)] flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          Review & Compute <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import {
  Plus,
  X,
  Sliders,
  Sparkles,
  MapPin,
  Trash2,
  Eye,
  Pencil,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { AuthImage } from '../components/ui/AuthImage';

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const Employees: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [employees, setEmployees] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [savingPrefix, setSavingPrefix] = useState(false);

  // Prefix & Series Setup State (Series Code, Connector, Sequence, Padding)
  const [prefixForm, setPrefixForm] = useState({
    seriesCode: 'EMP',
    connector: '#',
    paddingDigits: 3,
    startSequence: 1,
    branchId: '',
  });

  const fetchPrefixSettings = async () => {
    try {
      const res = await apiClient.get('/employees/prefix-settings', {
        params: { branchId: currentBranch?.id || undefined }
      });
      if (res.data) {
        setPrefixForm({
          seriesCode: res.data.seriesCode || 'EMP',
          connector: res.data.connector ?? '#',
          paddingDigits: res.data.paddingDigits || 3,
          startSequence: res.data.startSequence || 1,
          branchId: currentBranch?.id || '',
        });
      }
    } catch (e) {
      console.error('Failed to load prefix settings', e);
    }
  };

  const handleSavePrefixSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPrefix(true);
      await apiClient.post('/employees/prefix-settings', {
        seriesCode: prefixForm.seriesCode.trim(),
        connector: prefixForm.connector,
        paddingDigits: Number(prefixForm.paddingDigits),
        startSequence: Number(prefixForm.startSequence),
      }, {
        params: { branchId: currentBranch?.id || undefined }
      });
      showSuccess(
        'Series Configured',
        `Employee code format for ${currentBranch?.name || 'Workspace'} set to ${prefixForm.seriesCode}${prefixForm.connector}${String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}.`
      );
      setPrefixModalOpen(false);
      fetchEmployees();
      window.dispatchEvent(new CustomEvent('hrdesk:branch_changed', { detail: { branchId: currentBranch?.id } }));
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not save series settings');
    } finally {
      setSavingPrefix(false);
    }
  };

  const fetchEmployees = useCallback(async (overrideBranchId?: string | null) => {
    try {
      setLoading(true);
      const apiStatus = archiveFilter === 'archived' ? 'inactive' : archiveFilter === 'all' ? undefined : 'active';
      const storedBranch = localStorage.getItem('hrdesk_active_branch');
      const effectiveBranchId = overrideBranchId !== undefined
        ? (overrideBranchId === 'all' || !overrideBranchId ? undefined : overrideBranchId)
        : (currentBranch?.id || (storedBranch && storedBranch !== 'all' ? storedBranch : undefined));

      const res = await apiClient.get('/employees', {
        params: {
          search: search || undefined,
          departmentId: departmentId || undefined,
          branchId: effectiveBranchId,
          status: apiStatus,
          page,
          pageSize,
        },
      });
      setEmployees(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      showError('Failed to load roster', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [archiveFilter, search, departmentId, currentBranch?.id, page, pageSize]);

  const fetchLookups = async () => {
    try {
      const res = await apiClient.get('/employees/lookups');
      setLookups(res.data);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees, currentOrganization?.id, currentBranch?.id]);

  // Listen to tenant and branch change events
  useEffect(() => {
    const handleTenantChange = () => {
      setPage(1);
      fetchEmployees();
      fetchLookups();
    };
    const handleBranchChange = (e: any) => {
      setPage(1);
      const newBranchId = e?.detail?.branchId !== undefined ? e.detail.branchId : localStorage.getItem('hrdesk_active_branch');
      fetchEmployees(newBranchId);
    };

    window.addEventListener('hrdesk:tenant_changed', handleTenantChange);
    window.addEventListener('hrdesk:branch_changed', handleBranchChange);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleTenantChange);
      window.removeEventListener('hrdesk:branch_changed', handleBranchChange);
    };
  }, [fetchEmployees]);

  const handleExportCSV = () => {
    if (!employees.length) {
      showError('Export Empty', 'No employee records currently available to export.');
      return;
    }

    const headers = [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Full Legal Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'reportingManager', label: 'Reporting Manager' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'joiningDate', label: 'Joining Date' },
      { key: 'status', label: 'Status' },
    ];

    exportToCSV('Employees_Directory', employees, headers);
    showSuccess('Export Complete', 'Employee directory downloaded successfully.');
  };

  const handleRowClick = async (emp: any) => {
    navigate(`/employees/${emp.employeeId}`);
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await apiClient.post(`/employees/${id}/toggle-status`);
      showSuccess('Status Updated', `Employee #${id} status updated.`);
      fetchEmployees();
    } catch (err: any) {
      showError('Status update failed', err.response?.data?.message || 'Could not update status');
    }
  };

  const handleDeleteEmployee = async (id: number, name: string) => {
    if (!confirm(`PERMANENT DELETE: Are you sure you want to permanently delete "${name}" and ALL their records (attendance, leaves, documents, loans)? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/employees/${id}`);
      showSuccess('Employee Deleted', `${name} permanently deleted with all related records.`);
      fetchEmployees();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Could not delete employee');
    }
  };



  const canCreate = isAdmin || hasPermission('Employees.Create');
  const canEdit = isAdmin || hasPermission('Employees.Edit');

  return (
    <div className="space-y-6">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Employees
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Manage employee directory, profiles & reporting structure
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {totalCount} Total Employees
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified Common Action Toolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search employees by name, phone or ID..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (val) => {
            setArchiveFilter(val);
            setPage(1);
          },
        }}
        filters={[
          {
            id: 'department',
            value: departmentId,
            onChange: (val) => {
              setDepartmentId(val);
              setPage(1);
            },
            options: [
              { value: '', label: 'All Departments' },
              ...(lookups?.departments
                ?.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                .map((d: any) => ({
                  value: d.departmentId.toString(),
                  label: d.departmentName,
                })) || []),
            ],
          },
        ]}
        onExport={handleExportCSV}
        exportLabel="Export CSV"
        onImport={canCreate ? () => setImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={
          canCreate
            ? {
                label: 'Add Employee',
                icon: <Plus size={14} />,
                onClick: () => navigate('/employees/add'),
              }
            : undefined
        }
        customActions={
          canEdit ? (
            <button
              type="button"
              onClick={() => {
                fetchPrefixSettings();
                setPrefixModalOpen(true);
              }}
              className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold cursor-pointer border-[var(--rule)] hover:border-[var(--gold-500)] text-[var(--ink)]"
              title="Configure Series Code, Connector and Sequence"
            >
              <Sliders size={13} className="text-[var(--gold-500)]" />
              <span>Prefix Setup</span>
            </button>
          ) : undefined
        }
      />

      {/* 3. Primary Table: Ruled Ledger Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="register-table">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Employee Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Reporting Manager</th>
                <th className="text-right">Joining Date</th>
                <th className="text-center">Status</th>
                <th className="text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <TableSkeleton rows={8} />
                  </td>
                </tr>
              ) : employees.map((emp) => {
                const isActive = emp.status?.toLowerCase() === 'active';

                return (
                  <tr
                    key={emp.employeeId}
                    onClick={() => handleRowClick(emp)}
                    className="cursor-pointer"
                  >
                    <td className="text-center font-data text-xs text-[var(--ink-muted)]">
                      {emp.photoPath ? (
                        <AuthImage 
                          src={`/Thumbnail?employeeId=${emp.employeeId}`} 
                          alt={emp.employeeName} 
                          className="w-6 h-6 rounded-full object-cover mx-auto bg-[var(--paper)]" 
                          fallbackInitial={emp.employeeName.charAt(0)}
                          fallbackClassName="w-6 h-6 rounded-full text-[10px] mx-auto"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--navy-900)] text-[var(--gold-500)] font-bold flex items-center justify-center text-[10px] mx-auto">
                          {emp.employeeName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      {emp.employeeName}
                    </td>
                    <td className="font-data text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-[var(--paper)] border border-[var(--rule)] font-mono text-[11px] font-bold text-[var(--gold-600)] shadow-2xs">
                        {emp.employeeCode || (emp.branchCode ? `${emp.branchCode}${String(emp.employeeId).padStart(3, '0')}` : `EMP#${String(emp.employeeId).padStart(3, '0')}`)}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--ink)]">
                      {emp.department || 'General'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.designation || 'Staff'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.reportingManager || 'None'}
                    </td>
                    <td className="text-center font-data text-xs text-[var(--ink-muted)]">
                      {formatDate(emp.joiningDate)}
                    </td>
                    <td className="text-center text-xs">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <span className={isActive ? 'status-dot-ok' : 'status-dot-err'} />
                        <span className={isActive ? 'text-[var(--ok-600)]' : 'text-[var(--err-600)]'}>
                          {emp.status}
                        </span>
                      </span>
                    </td>
                    <td className="text-right">
                      <RowActionMenu actions={[
                        { label: 'View', icon: <Eye size={14} />, onClick: () => navigate(`/employees/${emp.employeeId}`) },
                        ...(canEdit ? [
                          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => navigate(`/employees/${emp.employeeId}/edit`) },
                        ] : []),
                        ...(canEdit ? [
                          isActive
                            ? { label: 'Archive', icon: <Archive size={14} />, onClick: () => handleToggleStatus(emp.employeeId), variant: 'danger' as const, dividerBefore: true }
                            : { label: 'Restore', icon: <RotateCcw size={14} />, onClick: () => handleToggleStatus(emp.employeeId), variant: 'success' as const, dividerBefore: true },
                        ] : []),
                        ...(!isActive && canEdit ? [
                          { label: 'Permanently Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteEmployee(emp.employeeId, emp.employeeName), variant: 'danger' as const },
                        ] : []),
                      ] as RowAction[]} />
                    </td>
                  </tr>
                );
              })}

              {employees.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                    No employees found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      {/* 6. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Employees"
        templateFilename="HRDesk_Employees"
        templateHeaders={['FullName', 'Phone', 'Department', 'Designation', 'JoiningDate', 'WeeklyOff']}
        templateSampleRow={['Ramesh Patel', '9876543210', 'Engineering', 'Software Engineer', '2026-01-15', 'Sunday']}
        onImportComplete={() => {
          setImportModalOpen(false);
          fetchEmployees();
        }}
      />

      {/* 7. Dedicated Employee ID & Prefix Setup Modal */}
      {prefixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center">
                  <Sliders size={16} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-[var(--ink)]">
                    Employee ID &amp; Prefix Setup
                  </h3>
                  <p className="text-[11px] text-[var(--ink-muted)] font-ui">
                    Series Formula: [Series] + [Connector] + [Sequence]
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPrefixModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrefixSettings} className="space-y-4 text-xs">
              {/* Active Branch Display Banner */}
              <div className="flex items-center justify-between p-2.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                <span className="text-[var(--ink-muted)] font-ui text-[11px]">Active Branch:</span>
                <span className="font-semibold text-xs text-[var(--gold-600)] flex items-center gap-1.5 font-ui">
                  <MapPin size={13} className="text-[var(--gold-500)]" />
                  {currentBranch ? currentBranch.name : 'All Branches (Company Default)'}
                </span>
              </div>

              {/* 1. Series Code & 2. Connector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">
                    1. Series Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={prefixForm.seriesCode}
                    onChange={(e) =>
                      setPrefixForm({ ...prefixForm, seriesCode: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. EMP, STAFF, SB"
                    className="register-input w-full font-mono text-xs font-bold uppercase tracking-wider"
                  />
                  <span className="text-[10px] text-[var(--ink-muted)] block mt-0.5">e.g. EMP, SB, VF</span>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">
                    2. Connector / Symbol
                  </label>
                  <input
                    type="text"
                    value={prefixForm.connector}
                    onChange={(e) => setPrefixForm({ ...prefixForm, connector: e.target.value })}
                    placeholder="e.g. #, -, @, /, _"
                    className="register-input w-full font-mono text-xs font-bold text-center"
                  />
                  <div className="flex items-center gap-1 mt-1">
                    {['#', '-', '@', '/', '_', '.'].map((sym) => (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => setPrefixForm({ ...prefixForm, connector: sym })}
                        className={`px-1.5 py-0.5 rounded-[2px] border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                          prefixForm.connector === sym
                            ? 'bg-[var(--gold-500)] text-[var(--navy-950)] border-[var(--gold-500)] font-bold'
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
                          ? 'bg-[var(--gold-500)] text-[var(--navy-950)] border-[var(--gold-500)]'
                          : 'bg-[var(--paper)] border-[var(--rule)] text-[var(--ink-muted)]'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Sequence Length */}
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">
                  3. Sequence Length *
                </label>
                <div className="flex items-center gap-2">
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
                    className="register-input w-24 font-mono text-xs font-bold text-center"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { len: 3, label: '3 Digits (001)' },
                      { len: 4, label: '4 Digits (0001)' },
                      { len: 5, label: '5 Digits (00001)' },
                      { len: 1, label: '1 (1, 2, 3...)' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.len}
                        onClick={() => setPrefixForm({ ...prefixForm, paddingDigits: item.len })}
                        className={`px-2 py-1 rounded-[2px] border text-[11px] font-mono cursor-pointer transition-colors ${
                          prefixForm.paddingDigits === item.len
                            ? 'bg-[var(--gold-500)] text-[var(--navy-950)] border-[var(--gold-500)] font-bold'
                            : 'bg-[var(--paper)] border-[var(--rule)] text-[var(--ink)] hover:border-[var(--gold-500)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-[var(--ink-muted)] block mt-1">
                  Defines the zero-padding length for generated employee numbers (e.g. 3 &rarr; 001)
                </span>
              </div>

              {/* 4. LIVE INTERACTIVE PREVIEW */}
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--gold-600)] font-ui flex items-center gap-1">
                    <Sparkles size={12} /> Live Preview Output
                  </span>
                  <span className="text-[10px] font-mono text-[var(--ink-muted)]">
                    [{prefixForm.seriesCode || 'EMP'}][{prefixForm.connector}][{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}]
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-[3px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
                  <span className="text-xs text-[var(--ink-muted)] font-ui">Next Generated ID:</span>
                  <span className="font-mono text-base font-bold text-[var(--gold-600)] tracking-wide">
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[var(--ink-muted)]">
                  <span>Series Samples:</span>
                  <span className="font-bold text-[var(--ink)]">
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence + 1).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence + 2).padStart(prefixForm.paddingDigits, '0')}
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
                  className="btn-primary disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingPrefix ? 'Saving...' : 'Save & Apply Setup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

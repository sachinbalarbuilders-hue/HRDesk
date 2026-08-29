import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
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
  Link,
  Copy,
} from 'lucide-react';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';
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
  const [generateLinkModalOpen, setGenerateLinkModalOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [onboardingForm, setOnboardingForm] = useState({ employeeName: '', workEmail: '', departmentId: '', designationId: '' });

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

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingForm.employeeName.trim()) {
      showError('Error', 'Employee name is required.');
      return;
    }
    try {
      setGeneratingLink(true);
      const res = await apiClient.post('/employees/generate-onboarding', {
        employeeName: onboardingForm.employeeName,
        workEmail: onboardingForm.workEmail || undefined,
        departmentId: onboardingForm.departmentId ? parseInt(onboardingForm.departmentId) : undefined,
        designationId: onboardingForm.designationId ? parseInt(onboardingForm.designationId) : undefined,
        branchId: currentBranch?.id || undefined
      });
      setGeneratedLink(res.data.onboardingLink);
      showSuccess('Link Generated', 'Onboarding link created successfully.');
      fetchEmployees();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Could not generate link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      showSuccess('Copied', 'Link copied to clipboard!');
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
    navigate(`/employees/${emp.publicId}`);
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const employeeArchive = useArchiveActions({
    endpoint: '/employees',
    label: 'Employee',
    onDone: fetchEmployees,
  });



  const canCreate = isAdmin || hasPermission('Employees.Create');
  const canEdit = isAdmin || hasPermission('Employees.Edit');

  return (
    <PageContainer>
      <PageHeader title="Employee Directory" description="Manage your organization's workforce" />

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
          <>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setGeneratedLink('');
                  setOnboardingForm({ employeeName: '', workEmail: '', departmentId: '', designationId: '' });
                  setGenerateLinkModalOpen(true);
                }}
                className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold cursor-pointer border-[var(--rule)] hover:border-[var(--gold-500)] text-[var(--ink)]"
                title="Generate Self-Onboarding Link"
              >
                <Link size={13} className="text-[var(--gold-500)]" />
                <span>Generate Onboarding Link</span>
              </button>
            )}
            {canEdit && (
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
            )}
          </>
        }
      />

      {/* 3. Primary Table: Ruled Ledger Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="register-table">
            <thead>
              <tr>
                <th className="w-12 text-center font-mono text-xs uppercase text-[var(--ink-muted)]">Sr.</th>
                <th className="w-10 text-center">Photo</th>
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
                  <td colSpan={10} className="p-0">
                    <TableSkeleton rows={8} />
                  </td>
                </tr>
              ) : employees.map((emp, index) => {
                const isActive = emp.status?.toLowerCase() === 'active';
                const srNo = (page - 1) * pageSize + index + 1;

                return (
                  <tr
                    key={emp.employeeId}
                    onClick={() => handleRowClick(emp)}
                    className="cursor-pointer"
                  >
                    <td className="text-center font-mono text-xs text-[var(--ink-muted)] w-12">
                      {srNo}
                    </td>
                    <td className="text-center font-data text-xs text-[var(--ink-muted)] w-10">
                      <div className="w-7 h-7 mx-auto rounded-full overflow-hidden flex items-center justify-center bg-[var(--paper)] border border-[var(--rule)] shrink-0">
                        {emp.photoPath ? (
                          <AuthImage 
                            src={`/Thumbnail?employeeId=${emp.employeeId}`} 
                            alt={emp.employeeName} 
                            className="w-full h-full aspect-square object-cover" 
                            fallbackInitial={emp.employeeName.charAt(0)}
                            fallbackClassName="w-full h-full text-[10px] flex items-center justify-center bg-[var(--navy-900)] text-[var(--gold-500)] font-bold"
                          />
                        ) : (
                          <div className="w-full h-full bg-[var(--navy-900)] text-[var(--gold-500)] font-bold flex items-center justify-center text-[10px]">
                            {emp.employeeName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      {emp.employeeName}
                    </td>
                    <td className="font-data text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-[var(--paper)] border border-[var(--rule)] font-mono text-[11px] font-bold text-[var(--gold-600)] shadow-2xs">
                        {emp.employeeCode || `EMP#${String(emp.employeeId).padStart(3, '0')}`}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--ink)]">
                      {emp.department || '-'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.designation || '-'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.reportingManager || '-'}
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
                        { label: 'View', icon: <Eye size={14} />, onClick: () => navigate(`/employees/${emp.publicId}`) },
                        ...(canEdit ? [
                          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => navigate(`/employees/${emp.publicId}/edit`) },
                        ] : []),
                        ...(canEdit ? employeeArchive.rowActions({
                          id: emp.publicId,
                          name: emp.employeeName,
                          isArchived: isRowArchived(emp) || !isActive,
                        }) : []),
                      ] as RowAction[]} />
                    </td>
                  </tr>
                );
              })}

              {employees.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
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

      {generateLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center">
                  <Link size={16} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-[var(--ink)]">
                    Employee Self-Onboarding
                  </h3>
                  <p className="text-[11px] text-[var(--ink-muted)] font-ui">
                    Generate a secure link for the employee to fill their details.
                  </p>
                </div>
              </div>
              <button onClick={() => setGenerateLinkModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {!generatedLink ? (
              <form onSubmit={handleGenerateLink} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Employee Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardingForm.employeeName}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, employeeName: e.target.value })}
                    className="register-input w-full"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Work Email</label>
                  <input
                    type="email"
                    value={onboardingForm.workEmail}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, workEmail: e.target.value })}
                    className="register-input w-full"
                    placeholder="Optional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--ink)] mb-1">Department</label>
                    <select
                      className="register-input w-full"
                      value={onboardingForm.departmentId}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, departmentId: e.target.value })}
                    >
                      <option value="">Select...</option>
                      {lookups?.departments?.map((d: any) => (
                        <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--ink)] mb-1">Designation</label>
                    <select
                      className="register-input w-full"
                      value={onboardingForm.designationId}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, designationId: e.target.value })}
                    >
                      <option value="">Select...</option>
                      {lookups?.designations?.map((d: any) => (
                        <option key={d.designationId} value={d.designationId}>{d.designationName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                  <button type="button" onClick={() => setGenerateLinkModalOpen(false)} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={generatingLink} className="btn-primary disabled:opacity-50">
                    {generatingLink ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center">
                  <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-800">Link Generated Successfully!</p>
                  <p className="text-xs text-emerald-700 mt-1">Send this link to the employee so they can complete their onboarding profile.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={generatedLink} className="register-input flex-1 font-mono text-[10px]" />
                  <button onClick={handleCopyLink} className="btn-outline flex items-center gap-1 px-3" title="Copy to clipboard">
                    <Copy size={14} /> Copy
                  </button>
                </div>

                <div className="flex justify-end pt-3">
                  <button onClick={() => setGenerateLinkModalOpen(false)} className="btn-primary">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {employeeArchive.dialog}
    </PageContainer>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Users,
  UserMinus,
} from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { DataTable, type ColumnDef } from '../components/ui/DataTable';
import { AuthImage } from '../components/ui/AuthImage';
import { EmployeeExits } from './employees/EmployeeExits';
import { InitiateExitModal } from '../components/employees/InitiateExitModal';


interface EmployeesProps {
  defaultTab?: 'directory' | 'exits';
}

export const Employees: React.FC<EmployeesProps> = ({ defaultTab = 'directory' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'directory' | 'exits') || defaultTab;

  const setActiveTab = (tab: 'directory' | 'exits') => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  };

  const { hasPermission, isAdmin, getPermissionScope } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [employees, setEmployees] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const defaultPageSize = Number(localStorage.getItem('hrdesk_default_page_size')) || 20;
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Exit Modal State
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitTargetEmp, setExitTargetEmp] = useState<{ employeeId: number; employeeName: string } | null>(null);

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


    return () => {
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

  const canCreate = isAdmin || hasPermission('Employees.Create');
  const canEdit = isAdmin || hasPermission('Employees.Edit');

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const employeeArchive = useArchiveActions({
    endpoint: '/employees',
    label: 'Employee',
    permissionKey: 'Employees.Delete',
    onDone: fetchEmployees,
  });

  const canDelete = employeeArchive.canDelete;
  const canBulkDelete = employeeArchive.canBulkDelete;
  const canPermanentDelete = employeeArchive.canPermanentDelete;

  const columns: ColumnDef<any>[] = [
    {
      key: 'photo',
      header: 'Photo',
      width: '60px',
      align: 'center',
      render: (emp) => (
        <div className="w-9 h-9 mx-auto rounded-full overflow-hidden flex items-center justify-center bg-[var(--surface-secondary)] border border-[var(--border-strong)] shadow-xs shrink-0">
          {emp.photoPath ? (
            <AuthImage
              src={`/Thumbnail?employeeId=${emp.employeeId}`}
              alt={emp.employeeName}
              className="w-full h-full aspect-square object-cover"
              fallbackInitial={emp.employeeName?.charAt(0) || 'E'}
              fallbackClassName="w-full h-full text-xs flex items-center justify-center bg-[#312E81] text-white font-semibold"
            />
          ) : (
            <div className="w-full h-full bg-[#312E81] text-white font-semibold flex items-center justify-center text-xs">
              {emp.employeeName?.charAt(0) || 'E'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'employeeName',
      header: 'Employee Name',
      render: (emp) => (
        <button
          type="button"
          onClick={() => handleRowClick(emp)}
          className="font-semibold text-sm text-[var(--text-primary)] hover:text-[var(--accent)] text-left cursor-pointer transition-colors block"
        >
          {emp.employeeName}
        </button>
      ),
    },
    {
      key: 'employeeCode',
      header: 'Employee ID',
      render: (emp) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--surface-secondary)]  text-xs font-normal font-semibold text-[var(--text-secondary)] tracking-wider">
          {emp.employeeCode || `EMP#${String(emp.employeeId).padStart(3, '0')}`}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (emp) => (
        <span className="text-sm font-normal font-medium text-[var(--text-primary)]">
          {emp.department || <span className="text-[var(--text-muted)] italic text-xs">Not Assigned</span>}
        </span>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (emp) => (
        <span className="text-sm font-normal text-[var(--text-secondary)]">
          {emp.designation || <span className="text-[var(--text-muted)] italic text-xs">â€”</span>}
        </span>
      ),
    },
    {
      key: 'reportingManager',
      header: 'Reporting Manager',
      render: (emp) => (
        <span className="text-sm font-normal text-[var(--text-secondary)]">
          {emp.reportingManager || <span className="text-[var(--text-muted)] italic text-xs">â€”</span>}
        </span>
      ),
    },
    {
      key: 'joiningDate',
      header: 'Joining Date',
      align: 'center',
      render: (emp) => <span className=" text-xs font-normal text-[var(--text-secondary)]">{formatDate(emp.joiningDate)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (emp) => {
        const isActive = emp.status?.toLowerCase() === 'active';
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="capitalize">{emp.status || 'Inactive'}</span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (emp) => {
        const isActive = emp.status?.toLowerCase() === 'active';
        return (
          <RowActionMenu
            actions={[
              { label: 'View', icon: <Eye size={14} />, onClick: () => navigate(`/employees/${emp.publicId}`) },
              ...(canEdit ? [
                { label: 'Edit', icon: <Pencil size={14} />, onClick: () => navigate(`/employees/${emp.publicId}/edit`) },
              ] : []),
              ...(canEdit && isActive ? [
                {
                  label: 'Initiate Exit',
                  icon: <UserMinus size={14} className="text-amber-500" />,
                  onClick: () => {
                    setExitTargetEmp({ employeeId: emp.employeeId, employeeName: emp.employeeName });
                    setExitModalOpen(true);
                  },
                },
              ] : []),
              ...(canDelete ? employeeArchive.rowActions({
                id: emp.publicId,
                name: emp.employeeName,
                isArchived: isRowArchived(emp) || !isActive,
              }) : []),
            ] as RowAction[]}
          />
        );
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Employees" 
        description="Manage your organization's people, roles and employment lifecycle."
        actions={
          activeTab === 'exits' ? (
            canEdit && (
              <button
                onClick={() => {
                  setExitTargetEmp(null);
                  setExitModalOpen(true);
                }}
                className="btn-primary flex items-center gap-2 shadow-sm"
              >
                <UserMinus size={16} />
                <span>Initiate Exit</span>
              </button>
            )
          ) : (
            canCreate && (
              <button
                onClick={() => navigate('/employees/add')}
                className="btn-primary flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} />
                <span>Add Employee</span>
              </button>
            )
          )
        }
      />

      {/* Workspace Tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--border-strong)] mb-6 mt-2">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`pb-2.5 text-sm transition-colors cursor-pointer border-b-2 ${
            activeTab === 'directory'
              ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] font-normal hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
          }`}
        >
          Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exits')}
          className={`pb-2.5 text-sm transition-colors cursor-pointer border-b-2 ${
            activeTab === 'exits'
              ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] font-normal hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
          }`}
        >
          Offboarding
        </button>
      </div>



      {activeTab === 'exits' ? (
        <EmployeeExits />
      ) : (
        <div className="flex flex-col gap-6">
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
                    className="flex items-center gap-2 text-sm font-semibold h-9 px-3.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-xs transition-colors cursor-pointer"
                    title="Generate Self-Onboarding Link"
                  >
                    <Link size={14} className="text-[var(--accent)]" />
                    <span>Onboarding Link</span>
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      fetchPrefixSettings();
                      setPrefixModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-sm font-semibold h-9 px-3.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-xs transition-colors cursor-pointer"
                    title="Configure Series Code, Connector and Sequence"
                  >
                    <Sliders size={14} className="text-[var(--accent)]" />
                    <span>Prefix Setup</span>
                  </button>
                )}
              </>
            }
          />

          {/* 3. Primary DataTable with Multi-Selection & Bulk Actions */}
          <div className="flex-1">
            <DataTable
              columns={columns}
              data={employees}
              loading={loading}
              showSrNo={false}
              keyExtractor={(emp) => emp.publicId || emp.employeeId}
              selection={employeeArchive.getSelectionConfig(
                selectedIds,
                setSelectedIds,
                archiveFilter === 'archived'
              )}
              emptyMessage="No employees found matching search criteria."
              pagination={{
                page,
                pageSize,
                totalCount,
                totalPages,
                onPageChange: setPage,
                onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
              }}
            />
          </div>
        </div>
      )}

      {/* Initiate Exit Modal from row actions */}
      {exitModalOpen && (
        <InitiateExitModal
          isOpen={exitModalOpen}
          preselectedEmployee={exitTargetEmp}
          onClose={() => {
            setExitModalOpen(false);
            setExitTargetEmp(null);
          }}
          onSuccess={() => {
            fetchEmployees();
            setActiveTab('exits');
          }}
        />
      )}

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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[var(--accent)] flex items-center justify-center">
                  <Sliders size={16} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    Employee ID &amp; Prefix Setup
                  </h3>
                  <p className="text-sm font-normal text-[var(--text-secondary)]">
                    Series Formula: [Series] + [Connector] + [Sequence]
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPrefixModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrefixSettings} className="space-y-4 text-sm font-normal">
              {/* Active Branch Display Banner */}
              <div className="flex items-center justify-between p-2.5 rounded-[4px] bg-[var(--surface-secondary)] border border-[var(--border)]">
                <span className="text-[var(--text-secondary)] text-xs">Active Branch:</span>
                <span className="font-semibold text-sm text-[var(--accent)] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[var(--accent)]" />
                  {currentBranch ? currentBranch.name : 'All Branches (Company Default)'}
                </span>
              </div>

              {/* 1. Series Code & 2. Connector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
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
                    className="register-input w-full  text-xs font-semibold uppercase tracking-wider"
                  />
                  <span className="text-xs font-normal text-[var(--text-secondary)] block mt-1">e.g. EMP, SB, VF</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                    2. Connector / Symbol
                  </label>
                  <input
                    type="text"
                    value={prefixForm.connector}
                    onChange={(e) => setPrefixForm({ ...prefixForm, connector: e.target.value })}
                    placeholder="e.g. #, -, @, /, _"
                    className="register-input w-full  text-xs font-semibold text-center"
                  />
                  <div className="flex items-center gap-1 mt-1">
                    {['#', '-', '@', '/', '_', '.'].map((sym) => (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => setPrefixForm({ ...prefixForm, connector: sym })}
                        className={`px-1.5 py-0.5 rounded-[2px] border text-xs  font-semibold cursor-pointer transition-colors ${
                          prefixForm.connector === sym
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-xs'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPrefixForm({ ...prefixForm, connector: '' })}
                      className={`px-1.5 py-0.5 rounded-[2px] border text-xs font-normal cursor-pointer transition-colors ${
                        prefixForm.connector === ''
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-xs'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Sequence Length */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
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
                    className="register-input w-24  text-xs font-semibold text-center"
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
                        className={`px-2 py-1 rounded-[2px] border text-xs  cursor-pointer transition-colors ${
                          prefixForm.paddingDigits === item.len
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-xs'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-normal text-[var(--text-secondary)] block mt-1">
                  Defines the zero-padding length for generated employee numbers (e.g. 3 &rarr; 001)
                </span>
              </div>

              {/* 4. LIVE INTERACTIVE PREVIEW */}
              <div className="p-4 rounded-[4px] bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-semibold tracking-wider text-[var(--accent)] flex items-center gap-1">
                    <Sparkles size={12} /> Live Preview Output
                  </span>
                  <span className="text-xs  text-[var(--text-secondary)]">
                    [{prefixForm.seriesCode || 'EMP'}][{prefixForm.connector}][{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}]
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-[3px] bg-[var(--surface)] border border-[var(--border)] shadow-2xs">
                  <span className="text-xs font-normal text-[var(--text-secondary)]">Next Generated ID:</span>
                  <span className=" text-base font-semibold text-[var(--accent)] tracking-wide">
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between text-xs  text-[var(--text-secondary)]">
                  <span>Series Samples:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence + 1).padStart(prefixForm.paddingDigits, '0')}&nbsp;&rarr;&nbsp;
                    {prefixForm.seriesCode || 'EMP'}{prefixForm.connector}{String(prefixForm.startSequence + 2).padStart(prefixForm.paddingDigits, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-indigo-950/60 text-[var(--accent)] border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center">
                  <Link size={16} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    Employee Self-Onboarding
                  </h3>
                  <p className="text-sm font-normal text-[var(--text-secondary)]">
                    Generate a secure link for the employee to fill their details.
                  </p>
                </div>
              </div>
              <button onClick={() => setGenerateLinkModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {!generatedLink ? (
              <form onSubmit={handleGenerateLink} className="space-y-4 text-sm font-normal">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">Employee Name *</label>
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
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">Work Email</label>
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
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">Department</label>
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
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">Designation</label>
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

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
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
                  <p className="text-sm font-semibold text-emerald-800">Link Generated Successfully!</p>
                  <p className="text-xs text-emerald-700 mt-1">Send this link to the employee so they can complete their onboarding profile.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={generatedLink} className="register-input flex-1  text-xs" />
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


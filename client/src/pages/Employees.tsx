import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import {
  Plus,
  Phone,
  X,
  FileText,
  Calendar,
  MapPin,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';

export const Employees: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch, branches } = useOrganization();
  const [employees, setEmployees] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'attendance' | 'records'>('details');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingPrefix, setSavingPrefix] = useState(false);

  // Prefix & Series Setup State (Series Code, Connector, Sequence, Padding)
  const [prefixForm, setPrefixForm] = useState({
    seriesCode: 'EMP',
    connector: '#',
    paddingDigits: 3,
    startSequence: 1,
    branchId: '',
  });

  const [createForm, setCreateForm] = useState({
    employeeId: '',
    employeeName: '',
    phone: '',
    departmentId: '',
    designationId: '',
    reportingManagerId: '',
    branchId: '',
    weekoff: 'Sunday',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: '',
    bloodGroup: '',
    gender: '',
    attendanceType: 'Biometric',
    maritalStatus: '',
    nationality: '',
    workEmail: '',
    personalEmail: '',
    hasProbation: false,
    probationDays: 90,
    roleId: '',
    dateOfBirth: ''
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

  const handleToggleStatus = async (id: number) => {
    try {
      await apiClient.post(`/employees/${id}/toggle-status`);
      showSuccess('Status Updated', `Employee #${id} status updated.`);
      fetchEmployees();
      if (selectedEmployee?.employeeId === id) {
        setSelectedEmployee((prev: any) => ({
          ...prev,
          status: prev.status === 'Active' ? 'Inactive' : 'Active',
        }));
      }
    } catch (err: any) {
      showError('Status update failed', err.response?.data?.message || 'Could not update status');
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.employeeName.trim()) return;

    try {
      setCreating(true);
      await apiClient.post('/employees', {
        employeeId: createForm.employeeId ? parseInt(createForm.employeeId) : null,
        employeeName: createForm.employeeName,
        phone: createForm.phone || null,
        departmentId: createForm.departmentId ? parseInt(createForm.departmentId) : null,
        designationId: createForm.designationId ? parseInt(createForm.designationId) : null,
        reportingManagerId: createForm.reportingManagerId ? parseInt(createForm.reportingManagerId) : null,
        branchId: createForm.branchId ? parseInt(createForm.branchId) : (currentBranch?.id ? parseInt(currentBranch.id) : null),
        weekoff: createForm.weekoff,
        joiningDate: createForm.joiningDate || null,
        dateOfBirth: createForm.dateOfBirth || null,
        employmentType: createForm.employmentType || null,
        bloodGroup: createForm.bloodGroup || null,
        gender: createForm.gender || null,
        attendanceType: createForm.attendanceType || null,
        maritalStatus: createForm.maritalStatus || null,
        nationality: createForm.nationality || null,
        workEmail: createForm.workEmail || null,
        personalEmail: createForm.personalEmail || null,
        hasProbation: createForm.hasProbation,
        probationDays: createForm.probationDays,
        roleId: createForm.roleId ? parseInt(createForm.roleId) : null,
      });
      showSuccess('Employee Added', `${createForm.employeeName} added to directory.`);
      setCreateModalOpen(false);
      setCreateForm({
        employeeId: '',
        employeeName: '',
        phone: '',
        departmentId: '',
        designationId: '',
        reportingManagerId: '',
        branchId: currentBranch?.id || '',
        weekoff: 'Sunday',
        joiningDate: new Date().toISOString().split('T')[0],
      });
      fetchEmployees();
    } catch (err: any) {
      showError('Failed to add employee', err.response?.data?.message || 'Could not create employee record.');
    } finally {
      setCreating(false);
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
                onClick: () => setCreateModalOpen(true),
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
                    onClick={() => setSelectedEmployee(emp)}
                    className="cursor-pointer"
                  >
                    <td className="text-center font-data text-xs text-[var(--ink-muted)]">
                      <div className="w-6 h-6 rounded-[2px] bg-[var(--navy-900)] text-[var(--gold-500)] font-bold flex items-center justify-center text-[10px] mx-auto">
                        {emp.employeeName.charAt(0)}
                      </div>
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
                    <td className="text-right font-data text-xs text-[var(--ink-muted)]">
                      {emp.joiningDate || '-'}
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
                      <ArchiveActionButton
                        isArchived={!isActive}
                        onArchive={() => handleToggleStatus(emp.employeeId)}
                        onRestore={() => handleToggleStatus(emp.employeeId)}
                        itemName={emp.employeeName}
                      />
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

      {/* 4. Slide-in Profile Record Sheet (480px) */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            {/* Header with Serif Name */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  Employee Profile
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                  {selectedEmployee.employeeName}
                </h2>
                <p className="text-xs font-data text-[var(--ink-muted)]">
                  ID: #{selectedEmployee.employeeId} &nbsp;|&nbsp; Joined: {selectedEmployee.joiningDate || '-'}
                </p>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--rule)] text-xs font-ui">
              <button
                onClick={() => setProfileTab('details')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'details'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setProfileTab('attendance')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'attendance'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Attendance Summary
              </button>
              <button
                onClick={() => setProfileTab('records')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'records'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Documents
              </button>
            </div>

            {/* Tab 1: Details */}
            {profileTab === 'details' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Department & Designation</span>
                  <p className="font-semibold text-[var(--ink)] text-sm">{selectedEmployee.department || 'General'}</p>
                  <p className="text-[var(--ink-muted)]">{selectedEmployee.designation || 'Staff Member'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Reporting Manager</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.reportingManager || 'None'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Weekly Off</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.weekoff || 'Sunday'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Employment Type</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.employmentType || '-'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Attendance Type</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.attendanceType || '-'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Date of Birth</span>
                    <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.dateOfBirth ? new Date(selectedEmployee.dateOfBirth).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Gender & Blood</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.gender || '-'} / {selectedEmployee.bloodGroup || '-'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Marital & Nationality</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.maritalStatus || '-'} / {selectedEmployee.nationality || '-'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Emails</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5 truncate" title={selectedEmployee.workEmail}>{selectedEmployee.workEmail || 'No work email'}</p>
                    <p className="text-[var(--ink-muted)] truncate" title={selectedEmployee.personalEmail}>{selectedEmployee.personalEmail || 'No personal email'}</p>
                  </div>
                  <div className="col-span-2 p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Probation Details</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">
                      {selectedEmployee.hasProbation ? `Yes, ${selectedEmployee.probationDays} days` : 'No Probation'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Assigned Branch / Location</span>
                    <MapPin size={13} className="text-[var(--gold-500)]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedEmployee.branchId || ''}
                      onChange={async (e) => {
                        const newBranchId = e.target.value ? parseInt(e.target.value) : null;
                        try {
                          await apiClient.put(`/employees/${selectedEmployee.employeeId}`, {
                            employeeName: selectedEmployee.employeeName,
                            phone: selectedEmployee.phone,
                            departmentId: selectedEmployee.departmentId,
                            designationId: selectedEmployee.designationId,
                            reportingManagerId: selectedEmployee.reportingManagerId,
                            branchId: newBranchId,
                            weekoff: selectedEmployee.weekoff,
                          });
                          const matchedBranch = branches.find((b: any) => String(b.id) === String(newBranchId));
                          setSelectedEmployee((prev: any) => ({
                            ...prev,
                            branchId: newBranchId,
                            branch: matchedBranch?.name || null,
                          }));
                          showSuccess('Branch Updated', `Employee assigned to ${matchedBranch?.name || 'Unassigned'}.`);
                          fetchEmployees();
                        } catch (err: any) {
                          showError('Update Failed', err.response?.data?.message || 'Could not update branch');
                        }
                      }}
                      className="register-input w-full font-semibold text-xs"
                    >
                      <option value="">-- No Branch Assigned (All Branches) --</option>
                      {branches?.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city || b.code || 'Branch'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Phone Number</span>
                    <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.phone || '-'}</p>
                  </div>
                  <Phone size={14} className="text-[var(--ink-muted)]" />
                </div>
              </div>
            )}

            {/* Tab 2: Attendance */}
            {profileTab === 'attendance' && (
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <Calendar size={14} className="text-[var(--gold-500)]" />
                  <span>Attendance Overview</span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] font-ui">
                  Attendance is computed automatically via the backend attendance service.
                </p>
              </div>
            )}

            {/* Tab 3: Documents */}
            {profileTab === 'records' && (
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <FileText size={14} className="text-[var(--gold-500)]" />
                  <span>Employee Documents</span>
                </div>
                <p className="text-[var(--ink-muted)] font-data text-xs">
                  No electronic documents uploaded.
                </p>
              </div>
            )}

            {/* Action Bar */}
            {canEdit && (
              <div className="pt-3 border-t border-[var(--rule)]">
                <button
                  onClick={() => handleToggleStatus(selectedEmployee.employeeId)}
                  className="btn-outline w-full text-center cursor-pointer"
                >
                  Mark Employee as {selectedEmployee.status === 'Active' ? 'Inactive / Relieved' : 'Active'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Add Employee Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add New Employee
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Enter employee details to create profile</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form id="addEmployeeForm" onSubmit={handleCreateEmployee} className="space-y-6">
                {/* 1. Personal Details */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">1. Personal Details</h4>
                  
                  {/* Auto ID */}
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)] font-ui block">
                        Employee Code &amp; ID
                      </span>
                      <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                        System-generated with branch prefix
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-[var(--gold-600)] px-2.5 py-1 rounded-[3px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
                      {branches?.find((b: any) => String(b.id) === String(createForm.branchId || currentBranch?.id))?.code || 'EMP#'}00X (Auto)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Full Legal Name *</label>
                      <input type="text" required value={createForm.employeeName} onChange={(e) => setCreateForm({ ...createForm, employeeName: e.target.value })} placeholder="e.g. Ramesh Patel" className="register-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Date of Birth</label>
                      <input type="date" value={createForm.dateOfBirth} onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })} className="register-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Gender</label>
                      <select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })} className="register-input w-full">
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Blood Group</label>
                      <select value={createForm.bloodGroup} onChange={(e) => setCreateForm({ ...createForm, bloodGroup: e.target.value })} className="register-input w-full">
                        <option value="">Select</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Marital Status</label>
                      <select value={createForm.maritalStatus} onChange={(e) => setCreateForm({ ...createForm, maritalStatus: e.target.value })} className="register-input w-full">
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Nationality</label>
                      <input type="text" value={createForm.nationality} onChange={(e) => setCreateForm({ ...createForm, nationality: e.target.value })} placeholder="e.g. Indian" className="register-input w-full" />
                    </div>
                  </div>
                </section>

                {/* 2. Contact Details */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">2. Contact Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Phone Number</label>
                      <input type="text" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="9876543210" className="register-input w-full font-data" />
                    </div>
                    <div></div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Work Email</label>
                      <input type="email" value={createForm.workEmail} onChange={(e) => setCreateForm({ ...createForm, workEmail: e.target.value })} placeholder="work@company.com" className="register-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Personal Email</label>
                      <input type="email" value={createForm.personalEmail} onChange={(e) => setCreateForm({ ...createForm, personalEmail: e.target.value })} placeholder="personal@gmail.com" className="register-input w-full" />
                    </div>
                  </div>
                </section>

                {/* 3. Job Assignment */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">3. Job Assignment</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Branch / Site Location</label>
                      <div className="register-input w-full bg-[var(--paper)] text-[var(--ink-muted)] flex items-center">
                        {currentBranch?.name || 'All / Default HQ'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Employment Type</label>
                      <select value={createForm.employmentType} onChange={(e) => setCreateForm({ ...createForm, employmentType: e.target.value })} className="register-input w-full">
                        <option value="">Select Type</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department</label>
                      <select value={createForm.departmentId} onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })} className="register-input w-full">
                        <option value="">Select Department</option>
                        {lookups?.departments
                          ?.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                          .map((d: any) => (<option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Designation</label>
                      <select value={createForm.designationId} onChange={(e) => setCreateForm({ ...createForm, designationId: e.target.value })} className="register-input w-full">
                        <option value="">Select Designation</option>
                        {lookups?.designations
                          ?.filter((des: any) => !currentBranch?.id || String(des.branchId) === String(currentBranch.id))
                          .map((des: any) => (<option key={des.designationId} value={des.designationId}>{des.designationName}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Reporting Manager</label>
                      <select value={createForm.reportingManagerId} onChange={(e) => setCreateForm({ ...createForm, reportingManagerId: e.target.value })} className="register-input w-full">
                        <option value="">None (Top Level)</option>
                        {lookups?.managers
                          ?.filter((m: any) => !currentBranch?.id || String(m.branchId) === String(currentBranch.id))
                          .map((m: any) => (<option key={m.employeeId} value={m.employeeId}>{m.employeeName}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">User Role (Auto-create account)</label>
                      <select value={createForm.roleId} onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })} className="register-input w-full">
                        <option value="">No Login Access</option>
                        {lookups?.roles?.map((r: any) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* 4. Employment Rules */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">4. Employment Rules</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Joining Date</label>
                      <input type="date" value={createForm.joiningDate} onChange={(e) => setCreateForm({ ...createForm, joiningDate: e.target.value })} className="register-input w-full font-data" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Weekly Off</label>
                      <select value={createForm.weekoff} onChange={(e) => setCreateForm({ ...createForm, weekoff: e.target.value })} className="register-input w-full">
                        <option value="Sunday">Sunday</option>
                        <option value="Monday">Monday</option>
                        <option value="Saturday">Saturday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Attendance Type</label>
                      <select value={createForm.attendanceType} onChange={(e) => setCreateForm({ ...createForm, attendanceType: e.target.value })} className="register-input w-full">
                        <option value="Biometric">Biometric</option>
                        <option value="Web">Web Clock-in</option>
                        <option value="Manual">Manual</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-2">Probation Period?</label>
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-1.5 text-xs text-[var(--ink)] cursor-pointer">
                          <input type="radio" checked={createForm.hasProbation === true} onChange={() => setCreateForm({ ...createForm, hasProbation: true })} className="accent-[var(--gold-500)]" />
                          Yes
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[var(--ink)] cursor-pointer">
                          <input type="radio" checked={createForm.hasProbation === false} onChange={() => setCreateForm({ ...createForm, hasProbation: false })} className="accent-[var(--gold-500)]" />
                          No
                        </label>
                      </div>
                      {createForm.hasProbation && (
                        <div className="w-1/2">
                          <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">Probation Length (Days)</label>
                          <input type="number" min="0" value={createForm.probationDays} onChange={(e) => setCreateForm({ ...createForm, probationDays: Number(e.target.value) })} className="register-input w-full font-data" />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </form>
            </div>

            <div className="p-4 border-t border-[var(--rule)] bg-[var(--paper)] shrink-0 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-outline cursor-pointer">
                Cancel
              </button>
              <button form="addEmployeeForm" type="submit" disabled={creating} className="btn-primary disabled:opacity-50 cursor-pointer">
                {creating ? 'Saving...' : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
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

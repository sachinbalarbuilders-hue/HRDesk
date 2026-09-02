import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { exportToCSV } from '../../utils/csvHelper';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { BulkImportModal } from '../../components/ui/BulkImportModal';
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck,
  Plus,
  X,
  Edit2,
} from 'lucide-react';

export const LeaveTypesTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [leavePaidFilter, setLeavePaidFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState<{name: string, code: string, quota: number, isPaid: boolean, applicableAfterProbation: boolean, allowCarryForward: boolean, genderApplicability: string, maritalStatusApplicability: string, departmentIds: string[], designationIds: string[], roleIds: string[]}>({ name: '', code: '', quota: 0, isPaid: false, applicableAfterProbation: false, allowCarryForward: false, genderApplicability: 'All', maritalStatusApplicability: 'All', departmentIds: [], designationIds: [], roleIds: [] });
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<number | null>(null);
  const [leaveFormStep, setLeaveFormStep] = useState<1 | 2>(1);

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, rolesRes] = await Promise.all([
        apiClient.get('/masters/overview', {
          params: { branchId: currentBranch?.id || undefined }
        }).catch(() => null),
        apiClient.get('/roles').catch(() => ({ data: [] }))
      ]);

      if (res?.data) {
        if (res.data.departments) {
          setDepartments(res.data.departments.map((d: any) => ({
            id: d.id,
            name: d.name,
            status: d.status || 'Active',
          })));
        }
        if (res.data.designations) {
          setDesignations(res.data.designations.map((d: any) => ({
            id: d.id,
            title: d.name,
            status: d.status || 'Active',
          })));
        }
        if (res.data.leaveTypes) {
          setLeaveTypes(res.data.leaveTypes.map((l: any) => ({
            id: l.id, name: l.name, code: l.code || 'LV', quota: l.defaultDays, isPaid: l.isPaid,
            applicableAfterProbation: l.applicableAfterProbation, allowCarryForward: l.allowCarryForward,
            genderApplicability: l.genderApplicability || 'All',
            maritalStatusApplicability: l.maritalStatusApplicability || 'All',
            departmentIds: l.departmentIds ? l.departmentIds.split(',') : [],
            designationIds: l.designationIds ? l.designationIds.split(',') : [],
            roleIds: l.roleIds ? l.roleIds.split(',') : [],
            status: l.status || (l.archivedAt ? 'Archived' : 'Active'),
            archivedAt: l.archivedAt,
            branchId: l.branchId
          })));
        }
      }
      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (e) {
      console.error('Failed to load leave types', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => { fetchData(); };
    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, []);

  const handleAddLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveType.name.trim()) return;
    try {
      if (editingLeaveTypeId) {
        await apiClient.put(`/masters/leave-types/${editingLeaveTypeId}`, {
          name: newLeaveType.name,
          code: newLeaveType.code || 'LV',
          defaultYearlyQuota: newLeaveType.quota,
          isPaid: newLeaveType.isPaid,
          applicableAfterProbation: newLeaveType.applicableAfterProbation,
          allowCarryForward: newLeaveType.allowCarryForward,
          genderApplicability: newLeaveType.genderApplicability,
          maritalStatusApplicability: newLeaveType.maritalStatusApplicability,
          departmentIds: newLeaveType.departmentIds.length > 0 ? newLeaveType.departmentIds.join(',') : null,
          designationIds: newLeaveType.designationIds.length > 0 ? newLeaveType.designationIds.join(',') : null,
          roleIds: newLeaveType.roleIds.length > 0 ? newLeaveType.roleIds.join(',') : null,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Leave Type Updated', `${newLeaveType.name} updated.`);
      } else {
        await apiClient.post('/masters/leave-types', {
          name: newLeaveType.name,
          code: newLeaveType.code || 'LV',
          defaultYearlyQuota: newLeaveType.quota,
          isPaid: newLeaveType.isPaid,
          applicableAfterProbation: newLeaveType.applicableAfterProbation,
          allowCarryForward: newLeaveType.allowCarryForward,
          genderApplicability: newLeaveType.genderApplicability,
          maritalStatusApplicability: newLeaveType.maritalStatusApplicability,
          departmentIds: newLeaveType.departmentIds.length > 0 ? newLeaveType.departmentIds.join(',') : null,
          designationIds: newLeaveType.designationIds.length > 0 ? newLeaveType.designationIds.join(',') : null,
          roleIds: newLeaveType.roleIds.length > 0 ? newLeaveType.roleIds.join(',') : null,
          status: 'Active',
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Leave Category Added', `${newLeaveType.name} configured.`);
      }
      setNewLeaveType({ name: '', code: '', quota: 0, isPaid: false, applicableAfterProbation: false, allowCarryForward: false, genderApplicability: 'All', maritalStatusApplicability: 'All', departmentIds: [], designationIds: [], roleIds: [] });
      setEditingLeaveTypeId(null);
      setLeaveModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleExport = () => {
    exportToCSV('HRDesk_Leave_Types', leaveTypes, [
      { key: 'name', label: 'Leave Category' },
      { key: 'code', label: 'Code' },
      { key: 'quota', label: 'Annual Quota' },
      { key: 'isPaid', label: 'Is Paid' },
    ]);
    showSuccess('Exported', 'Leave categories exported to CSV.');
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const archiveActions = useArchiveActions({
    endpoint: '/masters/leave-types',
    label: 'Leave Category',
    permissionKey: 'Leaves.Types.Delete',
    onDone: fetchData,
  });

  const s = search.trim().toLowerCase();
  const filteredLeaves = leaveTypes.filter(l => {
    const matchesSearch = !s || (l.name?.toLowerCase().includes(s)) || (l.code?.toLowerCase().includes(s));
    const matchesPaid = !leavePaidFilter || (leavePaidFilter === 'paid' ? l.isPaid : !l.isPaid);
    const isAct = l.status?.toLowerCase() !== 'inactive' && l.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesPaid && matchesArchive;
  });
  const paginatedLeaves = filteredLeaves.slice((page - 1) * pageSize, page * pageSize);

  const leaveColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Leave Category',
      render: (item) => (
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {item.code}
        </span>
      ),
    },
    {
      key: 'quota',
      header: 'Annual Quota',
      align: 'center',
      className: 'font-data font-bold text-xs text-[var(--ink)]',
      render: (item) =>
        item.code === 'CO' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Quota is earned dynamically through approved off-day duty claims">
            Earned via Comp-Off
          </span>
        ) : (
          `${item.quota} Days`
        ),
    },
    {
      key: 'isPaid',
      header: 'Compensation Type',
      render: (item) =>
        item.isPaid ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Paid Leave
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            Loss of Pay (Unpaid)
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) =>
        item.status?.toLowerCase() !== 'inactive' && item.status?.toLowerCase() !== 'archived' ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Archived
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => {
        const canEdit = isAdmin || hasPermission('Leaves.Types.Edit');
        const canDelete = isAdmin || hasPermission('Leaves.Types.Delete');
        const actions: RowAction[] = [];

        if (canEdit) {
          actions.push({
            label: 'Edit',
            icon: <Edit2 size={14} />,
            onClick: () => {
              setEditingLeaveTypeId(item.id);
              setNewLeaveType({
                name: item.name,
                code: item.code || '',
                quota: item.quota || 12,
                isPaid: item.isPaid !== false,
                applicableAfterProbation: item.applicableAfterProbation !== false,
                allowCarryForward: item.allowCarryForward === true,
                genderApplicability: item.genderApplicability || 'All',
                maritalStatusApplicability: item.maritalStatusApplicability || 'All',
                departmentIds: item.departmentIds || [],
                designationIds: item.designationIds || [],
                roleIds: item.roleIds || [],
              });
              setLeaveFormStep(1);
              setLeaveModalOpen(true);
            },
          });
        }

        if (canDelete) {
          actions.push(
            ...archiveActions.rowActions({
              id: item.id,
              name: item.name,
              isArchived: isRowArchived(item),
            })
          );
        }

        if (actions.length === 0) return null;

        return <RowActionMenu actions={actions} />;
      },
    },
  ];

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  return (
    <div className="space-y-4">
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search leave categories by name or code..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        filters={[
          {
            id: 'isPaid',
            ariaLabel: 'Paid Status Filter',
            value: leavePaidFilter,
            onChange: (v) => { setLeavePaidFilter(v); setPage(1); },
            options: [
              { value: '', label: 'All Leave Types' },
              { value: 'paid', label: 'Paid Leaves Only' },
              { value: 'unpaid', label: 'Unpaid Leaves Only' },
            ],
          },
        ]}
        onExport={handleExport}
        exportLabel="Export CSV"
        onImport={(isAdmin || hasPermission('Leaves.Types.Create')) ? () => setBulkImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={
          (isAdmin || hasPermission('Leaves.Types.Create'))
            ? {
                label: 'Add Leave Category',
                icon: <Plus size={14} />,
                onClick: () => {
                  setNewLeaveType({ name: '', code: '', quota: 0, isPaid: false, applicableAfterProbation: false, allowCarryForward: false, genderApplicability: 'All', maritalStatusApplicability: 'All', departmentIds: [], designationIds: [], roleIds: [] });
                  setLeaveFormStep(1);
                  setLeaveModalOpen(true);
                },
              }
            : undefined
        }
      />

      <DataTable
        columns={leaveColumns}
        data={paginatedLeaves}
        loading={loading}
        keyExtractor={(l) => l.id}
        selection={archiveActions.getSelectionConfig(
          selectedIds,
          setSelectedIds,
          archiveFilter === 'archived'
        )}
        emptyMessage="No leave categories configured."
        pagination={{
          page,
          pageSize,
          totalCount: filteredLeaves.length,
          totalPages: Math.ceil(filteredLeaves.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Leave Type 2-Step Wizard Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 shrink-0">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {editingLeaveTypeId ? 'Edit Leave Category' : 'Configure Leave Category'}
              </h3>
              <button onClick={() => { setLeaveModalOpen(false); setEditingLeaveTypeId(null); setLeaveFormStep(1); }} className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddLeaveType} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">

                {/* Step 1: Basic Details */}
                {leaveFormStep === 1 && (
                <div className="space-y-3.5">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-[var(--radius-md)] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-[10px] font-bold">1</span>
                    Basic Details
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Category Name *</label>
                    <input
                      type="text"
                      value={newLeaveType.name}
                      onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })}
                      placeholder="e.g. Paternity Leave"
                      className="register-input w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Code</label>
                      <input
                        type="text"
                        value={newLeaveType.code}
                        onChange={(e) => setNewLeaveType({ ...newLeaveType, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. PAT"
                        className="register-input w-full font-data"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Annual Quota (Days)</label>
                      <input
                        type="number"
                        min="0"
                        value={newLeaveType.quota === 0 ? '' : newLeaveType.quota}
                        placeholder="0"
                        onChange={(e) => setNewLeaveType({ ...newLeaveType, quota: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                        className="register-input w-full font-data"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-[var(--text-primary)]">Paid Leave (No salary deduction)</span>
                      <div className={`relative w-10 h-5 rounded-full transition-colors ${newLeaveType.isPaid ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} onClick={() => setNewLeaveType({ ...newLeaveType, isPaid: !newLeaveType.isPaid })}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${newLeaveType.isPaid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-[var(--text-primary)]">Applicable After Probation Only</span>
                      <div className={`relative w-10 h-5 rounded-full transition-colors ${newLeaveType.applicableAfterProbation ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} onClick={() => setNewLeaveType({ ...newLeaveType, applicableAfterProbation: !newLeaveType.applicableAfterProbation })}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${newLeaveType.applicableAfterProbation ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-[var(--text-primary)]">Allow Carry Forward to Next Year</span>
                      <div className={`relative w-10 h-5 rounded-full transition-colors ${newLeaveType.allowCarryForward ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} onClick={() => setNewLeaveType({ ...newLeaveType, allowCarryForward: !newLeaveType.allowCarryForward })}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${newLeaveType.allowCarryForward ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  </div>
                </div>
                )}

                {/* Step 2: Applicability Rules */}
                {leaveFormStep === 2 && (
                <div className="space-y-3.5">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-[var(--radius-md)] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-[10px] font-bold">2</span>
                    Applicability Rules
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] -mt-2">Leave empty to apply to all. Select specific values to restrict.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MultiSelectDropdown
                      label="Gender Applicability"
                      placeholder="All Genders (Select to limit)"
                      options={[
                        { label: 'Male', value: 'Male' },
                        { label: 'Female', value: 'Female' },
                        { label: 'Non-Binary', value: 'Non-Binary' },
                        { label: 'Transgender', value: 'Transgender' },
                        { label: 'Prefer not to say', value: 'Undisclosed' },
                      ]}
                      selectedValues={newLeaveType.genderApplicability === 'All' ? [] : newLeaveType.genderApplicability.split(',').filter(Boolean)}
                      onChange={(vals) => setNewLeaveType({ ...newLeaveType, genderApplicability: vals.length > 0 ? vals.join(',') : 'All' })}
                      searchable={false}
                    />
                    <MultiSelectDropdown
                      label="Marital Status"
                      placeholder="All Statuses (Select to limit)"
                      options={[
                        { label: 'Single', value: 'Single' },
                        { label: 'Married', value: 'Married' },
                        { label: 'Divorced', value: 'Divorced' },
                        { label: 'Widowed', value: 'Widowed' },
                        { label: 'Separated', value: 'Separated' },
                        { label: 'Domestic Partner', value: 'Domestic Partner' },
                      ]}
                      selectedValues={newLeaveType.maritalStatusApplicability === 'All' ? [] : newLeaveType.maritalStatusApplicability.split(',').filter(Boolean)}
                      onChange={(vals) => setNewLeaveType({ ...newLeaveType, maritalStatusApplicability: vals.length > 0 ? vals.join(',') : 'All' })}
                      searchable={false}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MultiSelectDropdown
                      label="Limit to Departments"
                      placeholder="All Departments (Select to limit)"
                      options={departments.filter(d => d.status === 'Active' || d.status === 'active').map(d => ({ label: d.name, value: d.id.toString() }))}
                      selectedValues={newLeaveType.departmentIds}
                      onChange={(vals) => setNewLeaveType({ ...newLeaveType, departmentIds: vals as string[] })}
                    />
                    <MultiSelectDropdown
                      label="Limit to Designations"
                      placeholder="All Designations (Select to limit)"
                      options={designations.filter(d => d.status === 'Active' || d.status === 'active').map(d => ({ label: d.title, value: d.id.toString() }))}
                      selectedValues={newLeaveType.designationIds}
                      onChange={(vals) => setNewLeaveType({ ...newLeaveType, designationIds: vals as string[] })}
                    />
                  </div>

                  <div>
                    <MultiSelectDropdown
                      label="Limit to User Roles"
                      placeholder="All Roles (Select to limit)"
                      options={roles.map(r => ({ label: r.name, value: r.id.toString() }))}
                      selectedValues={newLeaveType.roleIds}
                      onChange={(vals) => setNewLeaveType({ ...newLeaveType, roleIds: vals as string[] })}
                    />
                  </div>
                </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface-secondary)]">
                <div className="text-[11px] text-[var(--text-muted)]">Step {leaveFormStep} of 2</div>
                <div className="flex items-center gap-2">
                  {leaveFormStep === 1 ? (
                    <>
                      <button type="button" onClick={() => { setLeaveModalOpen(false); setEditingLeaveTypeId(null); setLeaveFormStep(1); }} className="btn-secondary">Cancel</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); if (!newLeaveType.name.trim()) return; setLeaveFormStep(2); }} className="btn-primary">Next →</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setLeaveFormStep(1)} className="btn-secondary">← Back</button>
                      <button type="submit" className="btn-primary">Save Category</button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        title="Import Leave Types"
        templateFilename="HRDesk_Leave_Types_Template"
        templateHeaders={['Name', 'Code', 'AnnualQuota', 'IsPaid']}
        templateSampleRow={['Paternity Leave', 'PAT', '15', 'true']}
        onImportComplete={() => {
          showSuccess('Import Complete', 'Records imported successfully.');
          fetchData();
        }}
      />

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {archiveActions.dialog}
    </div>
  );
};

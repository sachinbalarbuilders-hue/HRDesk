import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { exportToCSV } from '../../utils/csvHelper';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { BulkImportModal } from '../../components/ui/BulkImportModal';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { useAuth } from '../../context/AuthContext';
import {
  FolderTree,
  Plus,
  X,
  Edit2,
} from 'lucide-react';

export const DepartmentsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [departments, setDepartments] = useState<any[]>([]);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', code: '', head: '' });
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/masters/overview', {
        params: { branchId: currentBranch?.id || undefined }
      });
      if (res?.data?.departments) {
        setDepartments(res.data.departments.map((d: any) => ({
          id: d.id,
          name: d.name,
          code: `DEP-${d.id}`,
          head: 'HOD',
          status: d.status || (d.archivedAt ? 'Archived' : 'Active'),
          archivedAt: d.archivedAt,
          branchId: d.branchId,
        })));
      }
    } catch (e) {
      console.error('Failed to load departments', e);
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

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    try {
      if (editingDeptId) {
        await apiClient.put(`/masters/departments/${editingDeptId}`, {
          departmentName: newDept.name,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Department Updated', `${newDept.name} updated.`);
      } else {
        await apiClient.post('/masters/departments', {
          departmentName: newDept.name,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Department Added', `${newDept.name} registered.`);
      }
      setNewDept({ name: '', code: '', head: '' });
      setEditingDeptId(null);
      setDeptModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleExport = () => {
    exportToCSV('HRDesk_Departments', departments, [
      { key: 'name', label: 'Department Name' },
      { key: 'code', label: 'Department Code' },
      { key: 'head', label: 'Primary Officer' },
    ]);
    showSuccess('Exported', 'Departments exported to CSV.');
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const archiveActions = useArchiveActions({
    endpoint: '/masters/departments',
    label: 'Department',
    onDone: fetchData,
  });

  const s = search.trim().toLowerCase();
  const filteredDepts = departments.filter(d => {
    const matchesSearch = !s || (d.name?.toLowerCase().includes(s)) || (d.code?.toLowerCase().includes(s));
    const isAct = d.status?.toLowerCase() !== 'inactive' && d.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesArchive;
  });
  const paginatedDepts = filteredDepts.slice((page - 1) * pageSize, page * pageSize);

  const deptColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Department Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <FolderTree size={14} className="text-[var(--gold-500)]" />
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
      key: 'head',
      header: 'Primary Officer / HOD',
      className: 'text-xs text-[var(--ink-muted)]',
      render: (item) => item.head || 'HOD',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const isAct = item.status?.toLowerCase() !== 'inactive' && item.status?.toLowerCase() !== 'archived';
        return (
          <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase tracking-wider ${
            isAct
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
          }`}>
            {isAct ? 'Active' : 'Archived'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => {
        const actions: RowAction[] = [];

        if (isAdmin || hasPermission('Masters.Departments.Edit')) {
          actions.push({
            label: 'Edit',
            icon: <Edit2 size={14} />,
            onClick: () => {
              setEditingDeptId(item.id);
              setNewDept({
                name: item.name,
                code: item.code || '',
                head: item.head || '',
              });
              setDeptModalOpen(true);
            },
          });
        }

        if (archiveActions.canDelete) {
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
      {archiveActions.dialog}

      <DataToolbar
        searchPlaceholder="Search departments by name or code..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        onExport={handleExport}
        exportLabel="Export CSV"
        primaryAction={
          (isAdmin || hasPermission('Masters.Departments.Create'))
            ? {
                label: 'Add Department',
                icon: <Plus size={14} />,
                onClick: () => {
                  setEditingDeptId(null);
                  setNewDept({ name: '', code: '', head: '' });
                  setDeptModalOpen(true);
                }
              }
            : undefined
        }
      />

      <DataTable
        columns={deptColumns}
        data={paginatedDepts}
        loading={loading}
        keyExtractor={(d) => d.id}
        selection={archiveActions.getSelectionConfig(
          selectedIds,
          setSelectedIds,
          archiveFilter === 'archived'
        )}
        emptyMessage="No departments found matching your search."
        pagination={{
          page,
          pageSize,
          totalCount: filteredDepts.length,
          totalPages: Math.ceil(filteredDepts.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Add/Edit Department Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <FolderTree size={16} className="text-[var(--gold-500)]" />
                <span>{editingDeptId ? 'Edit Department' : 'Create Department'}</span>
              </h3>
              <button onClick={() => { setDeptModalOpen(false); setEditingDeptId(null); }} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDept} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Department Name *</label>
                <input
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  placeholder="e.g. Civil Engineering"
                  className="register-input w-full"
                  required
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => { setDeptModalOpen(false); setEditingDeptId(null); }} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        title="Import Departments"
        templateFilename="HRDesk_Departments_Template"
        templateHeaders={['Name', 'Code', 'Head']}
        templateSampleRow={['Quality Assurance', 'QA', 'QA Lead']}
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

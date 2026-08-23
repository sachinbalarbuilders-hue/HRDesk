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
import {
  FolderTree,
  Plus,
  Trash2,
  X,
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';

export const DepartmentsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
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
          status: d.status || 'Active',
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
        const isArchived = item.status?.toLowerCase() === 'inactive' || item.status?.toLowerCase() === 'archived';
        return (
          <RowActionMenu actions={[
            { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => { setEditingDeptId(item.id); setNewDept({ name: item.name, code: item.code || '', head: item.head || '' }); setDeptModalOpen(true); } },
            isArchived
              ? { label: 'Restore', icon: <RotateCcw size={14} />, onClick: () => { setDepartments(departments.map(d => d.id === item.id ? { ...d, status: 'active' } : d)); showSuccess('Department Restored', `${item.name} restored.`); }, variant: 'success', dividerBefore: true }
              : { label: 'Archive', icon: <Archive size={14} />, onClick: () => { setDepartments(departments.map(d => d.id === item.id ? { ...d, status: 'inactive' } : d)); showSuccess('Department Archived', `${item.name} moved to archive.`); }, dividerBefore: true },
            { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => { setDepartments(departments.filter(d => d.id !== item.id)); showSuccess('Department Deleted', 'Department removed.'); }, variant: 'danger' },
          ] as RowAction[]} />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search departments by name or code..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        onExport={handleExport}
        exportLabel="Export CSV"
        onImport={() => setBulkImportModalOpen(true)}
        importLabel="Import CSV"
        primaryAction={{
          label: 'Add Department',
          icon: <Plus size={14} />,
          onClick: () => setDeptModalOpen(true),
        }}
      />

      <DataTable
        columns={deptColumns}
        data={paginatedDepts}
        loading={loading}
        emptyMessage="No departments found matching your search."
        pagination={{
          page,
          pageSize,
          totalCount: filteredDepts.length,
          totalPages: Math.ceil(filteredDepts.length / pageSize),
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
    </div>
  );
};

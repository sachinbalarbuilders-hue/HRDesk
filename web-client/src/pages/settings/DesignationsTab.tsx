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
  Award,
  Plus,
  X,
  Edit2,
} from 'lucide-react';

export const DesignationsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [designations, setDesignations] = useState<any[]>([]);
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [newDesignation, setNewDesignation] = useState({ title: '' });
  const [editingDesigId, setEditingDesigId] = useState<number | null>(null);

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/masters/overview', {
        params: { branchId: currentBranch?.id || undefined }
      });
      if (res?.data?.designations) {
        setDesignations(res.data.designations.map((d: any) => ({
          id: d.id,
          title: d.name,
          status: d.status || (d.archivedAt ? 'Archived' : 'Active'),
          archivedAt: d.archivedAt,
          branchId: d.branchId,
        })));
      }
    } catch (e) {
      console.error('Failed to load designations', e);
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

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignation.title.trim()) return;
    try {
      if (editingDesigId) {
        await apiClient.put(`/masters/designations/${editingDesigId}`, {
          designationName: newDesignation.title.trim(),
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Designation Updated', `${newDesignation.title} updated.`);
      } else {
        await apiClient.post('/masters/designations', {
          designationName: newDesignation.title.trim(),
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
        });
        showSuccess('Designation Added', `${newDesignation.title} registered.`);
      }
      setNewDesignation({ title: '' });
      setEditingDesigId(null);
      setDesigModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleExport = () => {
    exportToCSV('HRDesk_Designations', designations, [
      { key: 'title', label: 'Designation Title' },
      { key: 'status', label: 'Status' },
    ]);
    showSuccess('Exported', 'Designations exported to CSV.');
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const archiveActions = useArchiveActions({
    endpoint: '/masters/designations',
    label: 'Designation',
    permissionKey: 'Masters.Designations.Delete',
    onDone: fetchData,
  });

  const s = search.trim().toLowerCase();
  const filteredDesigs = designations.filter(d => {
    const matchesSearch = !s || (d.title?.toLowerCase().includes(s));
    const isAct = d.status?.toLowerCase() !== 'inactive' && d.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesArchive;
  });
  const paginatedDesigs = filteredDesigs.slice((page - 1) * pageSize, page * pageSize);

  const desigColumns: ColumnDef<any>[] = [
    {
      key: 'title',
      header: 'Designation Title',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Award size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.title}</span>
        </div>
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
        const canEdit = isAdmin || hasPermission('Masters.Designations.Edit');
        const canDelete = isAdmin || hasPermission('Masters.Designations.Delete');
        const actions: RowAction[] = [];

        if (canEdit) {
          actions.push({
            label: 'Edit',
            icon: <Edit2 size={14} />,
            onClick: () => {
              setEditingDesigId(item.id);
              setNewDesignation({ title: item.title || item.name || '' });
              setDesigModalOpen(true);
            },
          });
        }

        if (canDelete) {
          actions.push(
            ...archiveActions.rowActions({
              id: item.id,
              name: item.title,
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
        searchPlaceholder="Search designations by title..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        onExport={handleExport}
        exportLabel="Export CSV"
        onImport={(isAdmin || hasPermission('Masters.Designations.Create')) ? () => setBulkImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={
          (isAdmin || hasPermission('Masters.Designations.Create'))
            ? {
                label: 'Add Designation',
                icon: <Plus size={14} />,
                onClick: () => {
                  setEditingDesigId(null);
                  setNewDesignation({ title: '' });
                  setDesigModalOpen(true);
                },
              }
            : undefined
        }
      />

      <DataTable
        columns={desigColumns}
        data={paginatedDesigs}
        loading={loading}
        keyExtractor={(d) => d.id}
        selection={archiveActions.getSelectionConfig(
          selectedIds,
          setSelectedIds,
          archiveFilter === 'archived'
        )}
        emptyMessage="No designations found matching your search."
        pagination={{
          page,
          pageSize,
          totalCount: filteredDesigs.length,
          totalPages: Math.ceil(filteredDesigs.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Add/Edit Designation Modal */}
      {desigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Award size={16} className="text-[var(--gold-500)]" />
                <span>{editingDesigId ? 'Edit Designation' : 'Create Designation'}</span>
              </h3>
              <button onClick={() => { setDesigModalOpen(false); setEditingDesigId(null); }} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDesignation} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Designation Title *</label>
                <input
                  type="text"
                  value={newDesignation.title}
                  onChange={(e) => setNewDesignation({ title: e.target.value })}
                  placeholder="e.g. Senior Project Manager"
                  className="register-input w-full"
                  required
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => { setDesigModalOpen(false); setEditingDesigId(null); }} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Designation
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
        title="Import Designations"
        templateFilename="HRDesk_Designations_Template"
        templateHeaders={['Title']}
        templateSampleRow={['DevOps Specialist']}
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

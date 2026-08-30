import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../components/ui/DataTable';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Calendar as CalendarIcon,
  Plus,
  Edit2,
  X,
  Globe,
  Building,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  isGlobal: boolean;
  applicableTo: string;
  description: string;
  archivedAt?: string | null;
  status?: string;
}

export const Holidays: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Modals
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    days: 1,
    isGlobal: true,
    applicableTo: 'All Branches',
    description: '',
  });

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/holidays', {
        params: {
          year: yearFilter,
          branchId: currentBranch?.id || undefined,
          search: search || undefined,
          status: archiveFilter,
          archiveStatus: archiveFilter,
        },
      });
      const items = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];
      setHolidays(items);
    } catch {
      showError('Failed to load holidays', 'Unable to retrieve holiday schedule.');
    } finally {
      setLoading(false);
    }
  }, [yearFilter, currentBranch?.id, search, archiveFilter]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Handle Tenant/Branch switcher events
  useEffect(() => {
    const handleContextChange = () => {
      fetchHolidays();
    };
    window.addEventListener('hrdesk:tenant_changed', handleContextChange);
    window.addEventListener('hrdesk:branch_changed', handleContextChange);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleContextChange);
      window.removeEventListener('hrdesk:branch_changed', handleContextChange);
    };
  }, [fetchHolidays]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      days: 1,
      isGlobal: true,
      applicableTo: 'All Branches',
      description: '',
    });
    setHolidayModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingId(h.id);
    setForm({
      name: h.name,
      startDate: h.startDate,
      endDate: h.endDate,
      days: h.days,
      isGlobal: h.isGlobal,
      applicableTo: h.applicableTo || 'All Branches',
      description: h.description || '',
    });
    setHolidayModalOpen(true);
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const holidayArchive = useArchiveActions({
    endpoint: '/holidays',
    label: 'Holiday',
    onDone: fetchHolidays,
  });

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showError('Validation Error', 'Holiday title is required.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await apiClient.put(`/holidays/${editingId}`, {
          ...form,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null,
        });
        showSuccess('Holiday Updated', 'Holiday details updated successfully.');
      } else {
        await apiClient.post('/holidays', {
          ...form,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : null,
        });
        showSuccess('Holiday Registered', 'New holiday added to the calendar.');
      }
      setHolidayModalOpen(false);
      fetchHolidays();
    } catch (err: any) {
      showError('Failed to save', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const holidayList = Array.isArray(holidays) ? holidays : [];
    exportToCSV(`Company_Holidays_${yearFilter}`, holidayList, [
      { key: 'name', label: 'Holiday Title' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'days', label: 'Days Duration' },
      { key: 'isGlobal', label: 'Is Global' },
      { key: 'applicableTo', label: 'Applicable Branch' },
      { key: 'description', label: 'Description' },
    ]);
    showSuccess('Export Complete', 'Holiday calendar exported to CSV.');
  };

  // Archive & Search filtering on returned list
  const holidayList = Array.isArray(holidays) ? holidays : [];
  const filteredHolidays = holidayList.filter(h => {
    const isAct = !isRowArchived(h);
    return archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
  });
  const totalCount = filteredHolidays.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedHolidays = filteredHolidays.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<Holiday>[] = [
    {
      key: 'name',
      header: 'Holiday Title',
      render: (h) => (
        <div className="font-semibold text-[var(--ink)] flex items-center gap-2 text-xs">
          <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{h.name}</span>
        </div>
      ),
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (h) => <span className="font-mono text-xs text-[var(--ink)]">{h.startDate}</span>,
    },
    {
      key: 'endDate',
      header: 'End Date',
      render: (h) => <span className="font-mono text-xs text-[var(--ink)]">{h.endDate}</span>,
    },
    {
      key: 'days',
      header: 'Duration',
      render: (h) => (
        <span className="font-mono font-bold text-xs text-[var(--accent)]">
          {h.days} {h.days === 1 ? 'Day' : 'Days'}
        </span>
      ),
    },
    {
      key: 'applicableTo',
      header: 'Applicability',
      render: (h) =>
        h.isGlobal ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Globe className="w-3 h-3" />
            Company-wide
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Building className="w-3 h-3" />
            {h.applicableTo}
          </span>
        ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (h) => (
        <span className="max-w-[240px] truncate text-xs text-[var(--ink-muted)] block" title={h.description}>
          {h.description || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (h) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Edit2 className="w-3.5 h-3.5" />, onClick: () => handleOpenEdit(h) },
            ...holidayArchive.rowActions({
              id: h.id,
              name: h.name,
              isArchived: isRowArchived(h),
            }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Holidays" description="Organization holiday calendar" />

      {/* 2. Unified Data Toolbar */}
      <DataToolbar
        searchPlaceholder="Search holiday title or description..."
        searchValue={search}
        onSearchChange={setSearch}
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        filters={[
          {
            id: 'year',
            ariaLabel: 'Calendar Year',
            value: yearFilter,
            onChange: (v) => { setYearFilter(v); setPage(1); },
            options: [
              { value: '2025', label: 'Year 2025' },
              { value: '2026', label: 'Year 2026' },
              { value: '2027', label: 'Year 2027' },
            ],
          },
        ]}
        onExport={handleExport}
        onImport={() => setImportModalOpen(true)}
        primaryAction={{
          label: 'Add Holiday',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: handleOpenAdd,
        }}
      />

      {/* 3. Holidays DataTable with Selection & Bulk Actions */}
      <DataTable
        columns={columns}
        data={paginatedHolidays}
        loading={loading}
        keyExtractor={(h) => h.id}
        selection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys),
          bulkActions: holidayArchive.bulkActions(archiveFilter === 'archived'),
        }}
        emptyMessage={`No official holidays registered for year ${yearFilter}. Click "Add Holiday" to register one.`}
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Add/Edit Holiday Modal */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[var(--accent)]" />
                {editingId ? 'Edit Holiday' : 'Register Holiday'}
              </h3>
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs font-ui">
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Holiday Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day, Diwali"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-data"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">End Date *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Number of Days</label>
                  <input
                    type="number"
                    min={1}
                    value={form.days}
                    onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-data"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Scope</label>
                  <select
                    value={form.isGlobal ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isGlobal: e.target.value === 'true' })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)]"
                  >
                    <option value="true">Company-wide (All Branches)</option>
                    <option value="false">Branch Specific</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Description / Note</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or instructions..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Holiday' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Company Holidays"
        templateFilename="Holidays_Template"
        templateHeaders={['Holiday Title', 'Start Date (YYYY-MM-DD)', 'End Date (YYYY-MM-DD)', 'Days', 'Is Global (TRUE/FALSE)', 'Description']}
        templateSampleRow={['Independence Day', '2026-08-15', '2026-08-15', '1', 'TRUE', 'National Holiday']}
        onImportComplete={fetchHolidays}
      />

      {/* Render shared archive confirm dialog */}
      {holidayArchive.dialog}
    </PageContainer>
  );
};

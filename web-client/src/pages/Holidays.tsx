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
  Building2,
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
  branchId?: number | null;
  branchName?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  archivedAt?: string | null;
  status?: string;
}

export const Holidays: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
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
    scopeType: 'global' as 'global' | 'branch' | 'department',
    branchId: null as number | null,
    departmentId: null as number | null,
    description: '',
  });

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get('/masters', {
        params: { branchId: currentBranch?.id || undefined }
      });
      const items = Array.isArray(res.data?.departments)
        ? res.data.departments
        : Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];
      setDepartments(items.map((d: any) => ({
        id: d.id || d.departmentId,
        name: d.name || d.departmentName,
      })));
    } catch (e) {
      console.error('Failed to load departments', e);
    }
  }, [currentBranch?.id]);

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/holidays', {
        params: {
          year: yearFilter,
          branchId: currentBranch?.id || undefined,
          departmentId: departmentFilter !== 'all' ? parseInt(departmentFilter) : undefined,
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
  }, [yearFilter, currentBranch?.id, departmentFilter, search, archiveFilter]);

  useEffect(() => {
    fetchDepartments();
    fetchHolidays();
  }, [fetchDepartments, fetchHolidays]);

  // Handle Tenant/Branch switcher events
  useEffect(() => {
    const handleContextChange = () => {
      fetchDepartments();
      fetchHolidays();
    };
    window.addEventListener('hrdesk:tenant_changed', handleContextChange);
    window.addEventListener('hrdesk:branch_changed', handleContextChange);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleContextChange);
      window.removeEventListener('hrdesk:branch_changed', handleContextChange);
    };
  }, [fetchDepartments, fetchHolidays]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      days: 1,
      scopeType: 'global',
      branchId: currentBranch?.id ? parseInt(currentBranch.id) : null,
      departmentId: null,
      description: '',
    });
    setHolidayModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingId(h.id);
    const scopeType = h.isGlobal ? 'global' : (h.departmentId ? 'department' : 'branch');
    setForm({
      name: h.name,
      startDate: h.startDate,
      endDate: h.endDate,
      days: h.days,
      scopeType,
      branchId: h.branchId ?? (currentBranch?.id ? parseInt(currentBranch.id) : null),
      departmentId: h.departmentId ?? null,
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

    if (form.scopeType === 'department' && !form.departmentId) {
      showError('Validation Error', 'Please select a department for department-specific holiday.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      days: form.days,
      description: form.description?.trim() || '',
      isGlobal: form.scopeType === 'global',
      branchId: form.scopeType === 'global' ? null : (form.branchId || (currentBranch?.id ? parseInt(currentBranch.id) : null)),
      departmentId: form.scopeType === 'department' ? (form.departmentId ? Number(form.departmentId) : null) : null,
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await apiClient.put(`/holidays/${editingId}`, payload);
        showSuccess('Holiday Updated', 'Holiday details updated successfully.');
      } else {
        await apiClient.post('/holidays', payload);
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
      { key: 'applicableTo', label: 'Applicability' },
      { key: 'departmentName', label: 'Department' },
      { key: 'branchName', label: 'Branch' },
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
      render: (h) => {
        if (h.isGlobal) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Globe className="w-3 h-3" />
              Company-wide
            </span>
          );
        }
        if (h.departmentName || h.departmentId) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Building2 className="w-3 h-3" />
              {h.departmentName ? `Dept: ${h.departmentName}` : h.applicableTo}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Building className="w-3 h-3" />
            {h.branchName ? `Branch: ${h.branchName}` : h.applicableTo}
          </span>
        );
      },
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
          onChange: (v) => { setArchiveFilter(v); setPage(1); setSelectedIds([]); },
        }}
        filters={[
          {
            id: 'year',
            ariaLabel: 'Calendar Year',
            value: yearFilter,
            onChange: (v) => { setYearFilter(v); setPage(1); setSelectedIds([]); },
            options: [
              { value: '2025', label: 'Year 2025' },
              { value: '2026', label: 'Year 2026' },
              { value: '2027', label: 'Year 2027' },
            ],
          },
          {
            id: 'department',
            ariaLabel: 'Department Filter',
            value: departmentFilter,
            onChange: (v) => { setDepartmentFilter(v); setPage(1); setSelectedIds([]); },
            options: [
              { value: 'all', label: 'All Scopes & Depts' },
              ...departments.map((d) => ({ value: String(d.id), label: d.name })),
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
                  placeholder="e.g. Independence Day, Diwali, Annual Maintenance Off"
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
                    value={form.scopeType}
                    onChange={(e) => setForm({ ...form, scopeType: e.target.value as any })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                  >
                    <option value="global">Company-wide (All Branches & Depts)</option>
                    <option value="branch">Branch Specific</option>
                    <option value="department">Department Specific</option>
                  </select>
                </div>
              </div>

              {form.scopeType === 'department' && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1 uppercase tracking-wider">Applicable Department *</label>
                  <select
                    required
                    value={form.departmentId ?? ''}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

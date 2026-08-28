import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  X,
  Globe,
  Building,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  isGlobal: boolean;
  applicableTo: string;
  description: string;
}

export const Holidays: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isGlobal: true,
    description: '',
  });

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/holidays', {
        params: {
          year: parseInt(yearFilter) || new Date().getFullYear(),
          search: search || undefined,
          branchId: currentBranch?.id || undefined,
        },
      });
      setHolidays(res.data.items || []);
    } catch (err: any) {
      showError('Failed to fetch holidays', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [yearFilter, search, currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchHolidays();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [yearFilter, search, currentOrganization?.id, currentBranch?.id]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      isGlobal: true,
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
      isGlobal: h.isGlobal,
      description: h.description,
    });
    setHolidayModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this official holiday record?')) return;
    try {
      await apiClient.delete(`/holidays/${id}`);
      showSuccess('Holiday Removed', 'Holiday deleted successfully.');
      fetchHolidays();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Server error');
    }
  };

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
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
        });
        showSuccess('Holiday Updated', `"${form.name}" has been updated.`);
      } else {
        await apiClient.post('/holidays', {
          ...form,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
        });
        showSuccess('Holiday Added', `"${form.name}" added to company calendar.`);
      }
      setHolidayModalOpen(false);
      fetchHolidays();
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!holidays.length) {
      showError('Export Empty', 'No holiday records to export.');
      return;
    }

    exportToCSV(
      `Company_Holidays_${yearFilter}`,
      holidays.map(h => ({
        'Holiday Name': h.name,
        'Start Date': h.startDate,
        'End Date': h.endDate,
        Days: h.days,
        Type: h.isGlobal ? 'Global Company-wide' : 'Department Specific',
        Scope: h.applicableTo,
        Description: h.description || '',
      }))
    );
    showSuccess('Exported', `Holidays for ${yearFilter} exported successfully.`);
  };

  // Pagination on returned list
  const totalCount = holidays.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedHolidays = holidays.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageContainer>
      <PageHeader title="Holidays" description="Organization holiday calendar" />

      {/* 2. Unified Data Toolbar */}
      <DataToolbar
        searchPlaceholder="Search holiday title or description..."
        searchValue={search}
        onSearchChange={setSearch}
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

      {/* 3. Holidays Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
            <div className="font-semibold text-sm text-[var(--ink)]">No Holidays Configured</div>
            <p className="mt-1">No official holidays registered for year {yearFilter}. Click "Add Holiday" to register one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] bg-[var(--paper-subtle)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 font-semibold w-12 text-center">Sr.</th>
                  <th className="p-3.5 font-semibold">Holiday Title</th>
                  <th className="p-3.5 font-semibold">Start Date</th>
                  <th className="p-3.5 font-semibold">End Date</th>
                  <th className="p-3.5 font-semibold">Duration</th>
                  <th className="p-3.5 font-semibold">Applicability</th>
                  <th className="p-3.5 font-semibold">Description</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {paginatedHolidays.map((h, idx) => {
                  const srNo = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr key={h.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                      <td className="p-3.5 font-mono text-center text-xs text-[var(--ink-muted)]">
                        {srNo}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[var(--ink)] flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>{h.name}</span>
                        </div>
                      </td>

                    <td className="p-3.5 font-mono text-[var(--ink)]">
                      {h.startDate}
                    </td>

                    <td className="p-3.5 font-mono text-[var(--ink)]">
                      {h.endDate}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-[var(--accent)]">
                      {h.days} {h.days === 1 ? 'Day' : 'Days'}
                    </td>

                    <td className="p-3.5">
                      {h.isGlobal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                          <Globe className="w-3 h-3" />
                          Company-wide
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          <Building className="w-3 h-3" />
                          {h.applicableTo}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 max-w-[240px] truncate text-[var(--ink-muted)]" title={h.description}>
                      {h.description || '—'}
                    </td>

                    <td className="p-3.5 text-right">
                      <RowActionMenu actions={[
                        { label: 'Edit', icon: <Edit2 className="w-3.5 h-3.5" />, onClick: () => handleOpenEdit(h) },
                        { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => handleDelete(h.id), variant: 'danger', dividerBefore: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && totalCount > 0 && (
          <div className="border-t border-[var(--rule)] p-3">
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* 4. Add / Edit Holiday Panel */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {editingId ? 'Edit Holiday' : 'Add Holiday'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Configure paid non-working calendar days.</p>
              </div>
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Holiday Title *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Independence Day, Diwali, New Year"
                  className="register-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value >= form.endDate ? e.target.value : form.endDate })}
                    className="register-input font-data"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">End Date *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="register-input font-data"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isGlobal}
                  onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Global holiday (all employees)</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Description / Notes</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Details regarding holiday observance or festival..."
                  rows={3}
                  className="register-input"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Holiday' : 'Save Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Company Holidays"
        templateFilename="Company_Holidays"
        templateHeaders={['HolidayName', 'StartDate', 'EndDate', 'IsGlobal', 'Description']}
        templateSampleRow={['Diwali Festival', '2026-11-08', '2026-11-09', 'true', 'Festival of Lights']}
        onImportComplete={() => {
          showSuccess('Imported', 'Holidays imported successfully.');
          fetchHolidays();
        }}
      />
    </PageContainer>
  );
};

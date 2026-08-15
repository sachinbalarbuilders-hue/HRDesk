import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  X,
  Globe,
  Building,
} from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isGlobal: true,
    applicableTo: 'All Departments',
    description: '',
  });

  const [holidays, setHolidays] = useState<Holiday[]>([
    {
      id: 1,
      name: 'New Year\'s Day',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'First day of the civil year',
    },
    {
      id: 2,
      name: 'Republic Day',
      startDate: '2026-01-26',
      endDate: '2026-01-26',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'National gazetted holiday',
    },
    {
      id: 3,
      name: 'Holi Festival',
      startDate: '2026-03-04',
      endDate: '2026-03-04',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'Festival of colours',
    },
    {
      id: 4,
      name: 'Eid-ul-Fitr',
      startDate: '2026-03-20',
      endDate: '2026-03-20',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'Islamic festival celebration',
    },
    {
      id: 5,
      name: 'Independence Day',
      startDate: '2026-08-15',
      endDate: '2026-08-15',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'Indian Independence Day',
    },
    {
      id: 6,
      name: 'Diwali & Deepavali',
      startDate: '2026-11-08',
      endDate: '2026-11-09',
      days: 2,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'Festival of lights',
    },
    {
      id: 7,
      name: 'Christmas Day',
      startDate: '2026-12-25',
      endDate: '2026-12-25',
      days: 1,
      isGlobal: true,
      applicableTo: 'All Staff',
      description: 'Christmas celebration',
    },
  ]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      isGlobal: true,
      applicableTo: 'All Departments',
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
      applicableTo: h.applicableTo,
      description: h.description,
    });
    setHolidayModalOpen(true);
  };

  const handleSaveHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showError('Validation Error', 'Holiday name is required.');
      return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (editingId) {
      setHolidays(holidays.map(h => h.id === editingId ? { ...h, ...form, days } : h));
      showSuccess('Holiday Updated', `${form.name} updated.`);
    } else {
      const newH: Holiday = {
        id: Date.now(),
        ...form,
        days,
      };
      setHolidays([...holidays, newH]);
      showSuccess('Holiday Added', `${form.name} added to holiday calendar.`);
    }
    setHolidayModalOpen(false);
  };

  const handleDeleteHoliday = (id: number) => {
    setHolidays(holidays.filter(h => h.id !== id));
    showSuccess('Holiday Removed', 'Holiday record deleted.');
  };

  const handleExportHolidays = () => {
    const headers = [
      { key: 'name', label: 'Holiday Name' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'days', label: 'Days' },
      { key: 'applicableTo', label: 'Applicability' },
      { key: 'description', label: 'Description' },
    ];
    exportToCSV(`HRDesk_Holidays_${yearFilter}`, filteredHolidays, headers);
    showSuccess('Holidays Exported', 'Holiday schedule downloaded to CSV.');
  };

  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.description.toLowerCase().includes(search.toLowerCase());
    const matchesYear = !yearFilter || h.startDate.startsWith(yearFilter);
    return matchesSearch && matchesYear;
  });

  const totalCount = filteredHolidays.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedHolidays = filteredHolidays.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Holiday Calendar
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Public, state & company gazetted holidays schedule
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {filteredHolidays.reduce((acc, h) => acc + h.days, 0)} Total Off Days
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search holiday by name or description..."
        filters={[
          {
            id: 'year',
            value: yearFilter,
            onChange: setYearFilter,
            options: [
              { value: '2026', label: 'Year 2026' },
              { value: '2025', label: 'Year 2025' },
              { value: '2027', label: 'Year 2027' },
            ],
          },
        ]}
        onExport={handleExportHolidays}
        exportLabel="Export Holidays"
        onImport={() => setImportModalOpen(true)}
        importLabel="Import Holidays"
        primaryAction={{
          label: 'Add Holiday',
          icon: <Plus size={14} />,
          onClick: handleOpenCreate,
        }}
      />

      {/* 3. Holidays Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <table className="register-table">
          <thead>
            <tr>
              <th className="font-data">Holiday Date(s)</th>
              <th>Holiday Name</th>
              <th className="text-center font-data">Duration</th>
              <th>Applicability</th>
              <th>Notes / Description</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedHolidays.map((h) => {
              const isPast = new Date(h.endDate) < new Date();

              return (
                <tr key={h.id} className={isPast ? 'opacity-60' : ''}>
                  {/* Date Badge */}
                  <td className="font-data text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-semibold text-[var(--ink)]">
                      <CalendarIcon size={12} className="text-[var(--gold-500)]" />
                      {h.startDate === h.endDate
                        ? new Date(h.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : `${new Date(h.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(h.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </span>
                  </td>

                  {/* Holiday Title */}
                  <td className="font-semibold text-xs text-[var(--ink)]">
                    {h.name}
                  </td>

                  {/* Days Count */}
                  <td className="text-center font-data text-xs text-[var(--ink)] font-semibold">
                    {h.days} {h.days === 1 ? 'day' : 'days'}
                  </td>

                  {/* Applicability */}
                  <td className="text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-data text-[10px] font-bold ${
                      h.isGlobal ? 'bg-[var(--navy-900)] text-[var(--gold-500)]' : 'bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)]'
                    }`}>
                      {h.isGlobal ? <Globe size={11} /> : <Building size={11} />}
                      <span>{h.applicableTo}</span>
                    </span>
                  </td>

                  {/* Description */}
                  <td className="text-xs text-[var(--ink-muted)]">
                    {h.description || '—'}
                  </td>

                  {/* Actions */}
                  <td className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(h)}
                        className="p-1 text-[var(--ink-muted)] hover:text-[var(--gold-500)] cursor-pointer"
                        title="Edit Holiday"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="p-1 text-[var(--ink-muted)] hover:text-[var(--err-600)] cursor-pointer"
                        title="Delete Holiday"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedHolidays.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                  No holidays scheduled for {yearFilter}.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 4. Ruled Pagination Toolbar */}
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

      {/* 4. Add / Edit Holiday Modal */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  {editingId ? 'Edit Holiday' : 'Add Gazetted Holiday'}
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Configure public or company holiday schedule</p>
              </div>
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dussehra / Vijayadashami"
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Applicability Scope
                </label>
                <select
                  value={form.isGlobal ? 'global' : 'branch'}
                  onChange={(e) => setForm({
                    ...form,
                    isGlobal: e.target.value === 'global',
                    applicableTo: e.target.value === 'global' ? 'All Staff (Global)' : 'Headquarters Only'
                  })}
                  className="register-input w-full"
                >
                  <option value="global">All Staff (Entire Organization)</option>
                  <option value="branch">Headquarters Office Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional context, tradition or gazette notification reference"
                  className="register-input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  {editingId ? 'Save Changes' : 'Register Holiday'}
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
        title="Import Holiday Calendar"
        templateFilename="HRDesk_Holidays_Template"
        templateHeaders={['HolidayName', 'StartDate', 'EndDate', 'IsGlobal', 'Description']}
        templateSampleRow={['Ganesh Chaturthi', '2026-09-14', '2026-09-14', 'TRUE', 'State gazetted holiday']}
        onImportComplete={() => {
          setImportModalOpen(false);
          showSuccess('Holidays Imported', 'Holiday schedule updated from CSV.');
        }}
      />
    </div>
  );
};

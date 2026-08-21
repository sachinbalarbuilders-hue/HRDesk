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
  Layers,
  Plus,
  Trash2,
  X,
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';

export const WorkShiftsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/masters/overview', {
        params: { branchId: currentBranch?.id || undefined }
      });
      if (res?.data?.shifts) {
        setShifts(res.data.shifts.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.code || 'SHF',
          startTime: s.startTime,
          endTime: s.endTime,
          lunchStart: s.lunchStart || '13:00',
          lunchEnd: s.lunchEnd || '14:00',
          breakMinutes: s.breakMinutes || 60,
          lateGrace: s.lateGrace || 15,
          earlyLeaveGrace: s.earlyLeaveGrace || 15,
          colorCode: s.colorCode || '#4e73df',
          halfTime: s.halfTime || '',
          status: 'Active',
          branchId: s.branchId,
        })));
      }
    } catch (e) {
      console.error('Failed to load shifts', e);
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

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name.trim()) return;
    try {
      await apiClient.post('/masters/shifts', {
        name: newShift.name,
        code: newShift.code || 'SHF',
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        lunchBreakStart: newShift.lunchStart,
        lunchBreakEnd: newShift.lunchEnd,
        breakMinutes: newShift.breakMinutes,
        lateComingGraceMinutes: newShift.lateGrace,
        earlyLeaveGraceMinutes: newShift.earlyLeaveGrace,
        colorCode: newShift.colorCode,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      });
      setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });
      setShiftModalOpen(false);
      showSuccess('Shift Registered', `${newShift.name} added to roster.`);
      fetchData();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleExport = () => {
    exportToCSV('HRDesk_Work_Shifts', shifts, [
      { key: 'name', label: 'Shift Name' },
      { key: 'code', label: 'Code' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'breakMinutes', label: 'Break Minutes' },
    ]);
    showSuccess('Exported', 'Work shifts exported to CSV.');
  };

  const s = search.trim().toLowerCase();
  const filteredShifts = shifts.filter(st => {
    const matchesSearch = !s || (st.name?.toLowerCase().includes(s)) || (st.code?.toLowerCase().includes(s));
    const isAct = st.status?.toLowerCase() !== 'inactive' && st.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesArchive;
  });
  const paginatedShifts = filteredShifts.slice((page - 1) * pageSize, page * pageSize);

  const shiftColumns: ColumnDef<any>[] = [
    {
      key: 'id',
      header: '#',
      width: '50px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'name',
      header: 'Shift Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[var(--gold-500)]" />
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
      key: 'timing',
      header: 'Timing',
      render: (item) => (
        <span className="font-data font-semibold text-xs text-emerald-700 dark:text-emerald-300">
          {item.startTime} – {item.endTime}
        </span>
      ),
    },
    {
      key: 'breakMinutes',
      header: 'Break Duration',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `${item.breakMinutes || 60} mins`,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => {
        const isArchived = item.status?.toLowerCase() === 'inactive' || item.status?.toLowerCase() === 'archived';
        return (
          <RowActionMenu actions={[
            {
              label: 'Edit',
              icon: <Edit2 size={14} />,
              onClick: () => {
                setNewShift({
                  name: item.name,
                  code: item.code,
                  startTime: item.startTime,
                  endTime: item.endTime,
                  lunchStart: item.lunchStart || '13:00',
                  lunchEnd: item.lunchEnd || '14:00',
                  breakMinutes: item.breakMinutes || 60,
                  lateGrace: item.lateGrace || 15,
                  earlyLeaveGrace: item.earlyLeaveGrace || 15,
                  colorCode: item.colorCode || '#4e73df',
                  halfTime: item.halfTime || ''
                });
                setShiftModalOpen(true);
              }
            },
            isArchived
              ? {
                  label: 'Restore',
                  icon: <RotateCcw size={14} />,
                  onClick: () => {
                    setShifts(shifts.map(sh => sh.id === item.id ? { ...sh, status: 'active' } : sh));
                    showSuccess('Shift Restored', `${item.name} restored.`);
                  },
                  variant: 'success',
                  dividerBefore: true
                }
              : {
                  label: 'Archive',
                  icon: <Archive size={14} />,
                  onClick: () => {
                    setShifts(shifts.map(sh => sh.id === item.id ? { ...sh, status: 'inactive' } : sh));
                    showSuccess('Shift Archived', `${item.name} moved to archive.`);
                  },
                  dividerBefore: true
                },
            {
              label: 'Delete',
              icon: <Trash2 size={14} />,
              onClick: () => {
                setShifts(shifts.filter(sh => sh.id !== item.id));
                showSuccess('Shift Removed', 'Shift removed from roster.');
              },
              variant: 'danger'
            }
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
        searchPlaceholder="Search shifts by name or code..."
        onExport={handleExport}
        exportLabel="Export CSV"
        onImport={() => setBulkImportModalOpen(true)}
        importLabel="Import CSV"
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        primaryAction={{
          label: 'Add Work Shift',
          icon: <Plus size={14} />,
          onClick: () => {
            setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });
            setShiftModalOpen(true);
          },
        }}
      />

      <DataTable
        columns={shiftColumns}
        data={paginatedShifts}
        loading={loading}
        emptyMessage="No work shifts defined."
        pagination={{
          page,
          pageSize,
          totalCount: filteredShifts.length,
          totalPages: Math.ceil(filteredShifts.length / pageSize),
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Add Shift Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Layers size={16} className="text-[var(--gold-500)]" />
                <span>Create Work Shift</span>
              </h3>
              <button onClick={() => setShiftModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddShift} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Shift Name *</label>
                  <input
                    type="text"
                    value={newShift.name}
                    onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                    placeholder="e.g. Night Shift"
                    className="register-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Shift Code</label>
                  <input
                    type="text"
                    value={newShift.code}
                    onChange={(e) => setNewShift({ ...newShift, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. NS, GEN"
                    className="register-input w-full font-data uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">End Time</label>
                  <input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Lunch Start</label>
                  <input
                    type="time"
                    value={newShift.lunchStart}
                    onChange={(e) => setNewShift({ ...newShift, lunchStart: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Lunch End</label>
                  <input
                    type="time"
                    value={newShift.lunchEnd}
                    onChange={(e) => setNewShift({ ...newShift, lunchEnd: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Break (mins)</label>
                  <input
                    type="number"
                    value={newShift.breakMinutes}
                    onChange={(e) => setNewShift({ ...newShift, breakMinutes: Number(e.target.value) })}
                    className="register-input w-full font-data"
                    min={0}
                    max={120}
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Late Grace (mins)</label>
                  <input
                    type="number"
                    value={newShift.lateGrace}
                    onChange={(e) => setNewShift({ ...newShift, lateGrace: Number(e.target.value) })}
                    className="register-input w-full font-data"
                    min={0}
                    max={60}
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Early Leave Grace (mins)</label>
                  <input
                    type="number"
                    value={newShift.earlyLeaveGrace}
                    onChange={(e) => setNewShift({ ...newShift, earlyLeaveGrace: Number(e.target.value) })}
                    className="register-input w-full font-data"
                    min={0}
                    max={60}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Half Day Cutoff Time</label>
                <input
                  type="time"
                  value={newShift.halfTime || ''}
                  onChange={(e) => setNewShift({ ...newShift, halfTime: e.target.value })}
                  className="register-input w-full font-data"
                />
                <p className="text-[10px] text-[var(--ink-muted)] mt-1">If not set, it is calculated automatically as the exact midpoint of the shift.</p>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Color Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newShift.colorCode}
                    onChange={(e) => setNewShift({ ...newShift, colorCode: e.target.value })}
                    className="w-8 h-8 rounded-[4px] border border-[var(--rule)] cursor-pointer"
                  />
                  <span className="font-data text-[var(--ink-muted)]">{newShift.colorCode}</span>
                </div>
              </div>

              {/* Working Hours Preview */}
              <div className="p-2.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
                <span className="text-[var(--ink-muted)]">Working Hours:</span>
                <span className="font-data font-bold text-[var(--gold-500)]">
                  {(() => {
                    const [sh, sm] = newShift.startTime.split(':').map(Number);
                    const [eh, em] = newShift.endTime.split(':').map(Number);
                    const totalMins = (eh * 60 + em) - (sh * 60 + sm) - newShift.breakMinutes;
                    return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
                  })()}
                </span>
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setShiftModalOpen(false)} className="btn-outline cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="btn-primary cursor-pointer">
                  Save Shift
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
        title="Import Work Shifts"
        templateFilename="HRDesk_Work_Shifts_Template"
        templateHeaders={['ShiftName', 'ShiftCode', 'StartTime', 'EndTime', 'BreakMinutes']}
        templateSampleRow={['Rotational Shift', 'ROT', '10:00', '19:00', '60']}
        onImportComplete={() => {
          showSuccess('Import Complete', 'Records imported successfully.');
          fetchData();
        }}
      />
    </div>
  );
};

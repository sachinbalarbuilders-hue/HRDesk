import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { exportToCSV } from '../../utils/csvHelper';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { BulkImportModal } from '../../components/ui/BulkImportModal';
import { ArchiveToggle, type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import {
  Layers,
  Plus,
  Trash2,
  X,
  Edit2,
  RefreshCw,
} from 'lucide-react';

// ─── Shift Cycles ─────────────────────────────────────────────────────────────

interface CycleSlot {
  slotIndex: number;
  shiftId: number | null;
  shiftName: string | null;
  shiftCode: string | null;
  colorCode: string | null;
  isWeekOff: boolean;
}

interface ShiftCycle {
  id: number;
  name: string;
  description: string | null;
  cycleLengthDays: number;
  slots: CycleSlot[];
}

const WEEK_OFF_COLOR = '#94a3b8';

function CyclePreviewStrip({ slots, cycleLengthDays }: { slots: CycleSlot[]; cycleLengthDays: number }) {
  const byIndex = Object.fromEntries(slots.map(s => [s.slotIndex, s]));
  // Show at most 2 full cycles, capped at 42 cells
  const total = Math.min(cycleLengthDays * 2, 42);
  return (
    <div className="flex flex-wrap gap-0.5 mt-1">
      {Array.from({ length: total }, (_, i) => {
        const slot = byIndex[i % cycleLengthDays];
        const isWO = slot?.isWeekOff ?? false;
        const color = isWO ? WEEK_OFF_COLOR : (slot?.colorCode ?? '#4e73df');
        const label = isWO ? 'W/O' : (slot?.shiftCode ?? '?');
        return (
          <div
            key={i}
            title={isWO ? 'Week Off' : (slot?.shiftName ?? 'Unknown')}
            className="flex items-center justify-center rounded-[2px] text-[8px] font-bold text-white"
            style={{ width: 26, height: 20, backgroundColor: color, opacity: i >= cycleLengthDays ? 0.45 : 1 }}
          >
            {label.slice(0, 3)}
          </div>
        );
      })}
      {cycleLengthDays > 21 && (
        <span className="text-[9px] text-[var(--ink-muted)] self-center ml-1">×2 preview</span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const WorkShiftsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeSubTab, setActiveSubTab] = useState<'shifts' | 'cycles'>('shifts');
  const [selectedShiftIds, setSelectedShiftIds] = useState<(string | number)[]>([]);

  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  // ── Shift Cycles state ──────────────────────────────────────────────────────
  const [cycles, setCycles] = useState<ShiftCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cycleArchiveFilter, setCycleArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [cyclePage, setCyclePage] = useState(1);
  const [cyclePageSize, setCyclePageSize] = useState(10);
  const [selectedCycleIds, setSelectedCycleIds] = useState<(string | number)[]>([]);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [cycleForm, setCycleForm] = useState({
    name: '',
    description: '',
    cycleLengthDays: 7,
  });
  const [cycleSlots, setCycleSlots] = useState<{ shiftId: number | null; isWeekOff: boolean }[]>(
    Array.from({ length: 7 }, () => ({ shiftId: null, isWeekOff: false }))
  );
  const [savingCycle, setSavingCycle] = useState(false);

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
          status: s.status || (s.archivedAt ? 'Archived' : 'Active'),
          archivedAt: s.archivedAt,
          branchId: s.branchId,
        })));
      }
    } catch (e) {
      console.error('Failed to load shifts', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCycles = async () => {
    try {
      setCyclesLoading(true);
      const res = await apiClient.get('/shifts/cycles', {
        params: { branchId: currentBranch?.id || undefined, archiveStatus: cycleArchiveFilter }
      });
      setCycles(res.data || []);
    } catch (e) {
      console.error('Failed to load shift cycles', e);
    } finally {
      setCyclesLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCycles();
  }, [currentBranch?.id]);

  useEffect(() => { fetchCycles(); }, [cycleArchiveFilter]);

  useEffect(() => {
    const handleReload = () => { fetchData(); fetchCycles(); };
    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, []);

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name.trim()) return;
    try {
      const payload = {
        name: newShift.name,
        code: newShift.code || 'SHF',
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        lunchBreakStart: newShift.lunchStart,
        lunchBreakEnd: newShift.lunchEnd,
        breakMinutes: newShift.breakMinutes,
        lateComingGraceMinutes: newShift.lateGrace,
        earlyLeaveGraceMinutes: newShift.earlyLeaveGrace,
        halfTime: newShift.halfTime || null,
        colorCode: newShift.colorCode,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      };

      if (editingShiftId) {
        await apiClient.put(`/masters/shifts/${editingShiftId}`, payload);
        showSuccess('Shift Updated', `${newShift.name} updated successfully.`);
      } else {
        await apiClient.post('/masters/shifts', payload);
        showSuccess('Shift Registered', `${newShift.name} added to roster.`);
      }

      setEditingShiftId(null);
      setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });
      setShiftModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  // ── Cycle handlers ──────────────────────────────────────────────────────────

  const openCreateCycle = () => {
    setEditingCycleId(null);
    setCycleForm({ name: '', description: '', cycleLengthDays: 7 });
    setCycleSlots(Array.from({ length: 7 }, () => ({ shiftId: null, isWeekOff: false })));
    setCycleModalOpen(true);
  };

  const openEditCycle = (cycle: ShiftCycle) => {
    setEditingCycleId(cycle.id);
    setCycleForm({ name: cycle.name, description: cycle.description ?? '', cycleLengthDays: cycle.cycleLengthDays });
    const slots = Array.from({ length: cycle.cycleLengthDays }, (_, i) => {
      const existing = cycle.slots.find(s => s.slotIndex === i);
      return existing
        ? { shiftId: existing.shiftId, isWeekOff: existing.isWeekOff }
        : { shiftId: null, isWeekOff: false };
    });
    setCycleSlots(slots);
    setCycleModalOpen(true);
  };

  const handleCycleLengthChange = (newLen: number) => {
    const clamped = Math.max(1, Math.min(365, newLen));
    setCycleForm(f => ({ ...f, cycleLengthDays: clamped }));
    setCycleSlots(prev => {
      const next = Array.from({ length: clamped }, (_, i) =>
        i < prev.length ? prev[i] : { shiftId: null, isWeekOff: false }
      );
      return next;
    });
  };

  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleForm.name.trim()) return;
    try {
      setSavingCycle(true);
      const payload = {
        name: cycleForm.name.trim(),
        description: cycleForm.description.trim() || null,
        cycleLengthDays: cycleForm.cycleLengthDays,
        slots: cycleSlots.map((s, i) => ({
          slotIndex: i,
          shiftId: s.isWeekOff ? null : s.shiftId,
          isWeekOff: s.isWeekOff,
        })),
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null,
      };

      if (editingCycleId) {
        await apiClient.put(`/shifts/cycles/${editingCycleId}`, payload);
        showSuccess('Cycle Updated', `${cycleForm.name} updated.`);
      } else {
        await apiClient.post('/shifts/cycles', payload);
        showSuccess('Cycle Created', `${cycleForm.name} created successfully.`);
      }

      setCycleModalOpen(false);
      fetchCycles();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSavingCycle(false);
    }
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const shiftArchive = useArchiveActions({
    endpoint: '/masters/shifts',
    label: 'Work Shift',
    onDone: fetchData,
  });

  const cycleArchive = useArchiveActions({
    endpoint: '/shifts/cycles',
    label: 'Shift Cycle',
    onDone: fetchCycles,
  });

  // ── Render helpers ──────────────────────────────────────────────────────────

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
      key: 'name',
      header: 'Shift Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.colorCode || '#4e73df' }} />
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
      render: (item) => (
        <RowActionMenu actions={[
          {
            label: 'Edit',
            icon: <Edit2 size={14} />,
            onClick: () => {
              setEditingShiftId(item.id);
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
          ...shiftArchive.rowActions({
            id: item.id,
            name: item.name,
            isArchived: isRowArchived(item),
          }),
        ] as RowAction[]} />
      ),
    },
  ];

  const [cycleSearch, setCycleSearch] = useState('');
  const sCycle = cycleSearch.trim().toLowerCase();
  const filteredCycles = cycles.filter(c => {
    const isAct = !isRowArchived(c);
    const matchesArchive = cycleArchiveFilter === 'all' || (cycleArchiveFilter === 'active' ? isAct : !isAct);
    const matchesSearch = !sCycle || c.name.toLowerCase().includes(sCycle) || (c.description && c.description.toLowerCase().includes(sCycle));
    return matchesArchive && matchesSearch;
  });
  const paginatedCycles = filteredCycles.slice((cyclePage - 1) * cyclePageSize, cyclePage * cyclePageSize);

  const cycleColumns: ColumnDef<ShiftCycle>[] = [
    {
      key: 'name',
      header: 'Rotation Cycle',
      render: (cycle) => (
        <div className="space-y-1 py-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[var(--ink)]">{cycle.name}</span>
            <span className="px-1.5 py-0.2 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] text-[10px] font-data font-bold text-[var(--ink-muted)]">
              {cycle.cycleLengthDays}-day cycle
            </span>
          </div>
          {cycle.description && <p className="text-[11px] text-[var(--ink-muted)]">{cycle.description}</p>}
          <CyclePreviewStrip slots={cycle.slots} cycleLengthDays={cycle.cycleLengthDays} />
        </div>
      ),
    },
    {
      key: 'shifts',
      header: 'Shifts Included',
      render: (cycle) => {
        const names = Array.from(new Set(cycle.slots.filter(s => !s.isWeekOff && s.shiftName).map(s => s.shiftName)));
        const hasWO = cycle.slots.some(s => s.isWeekOff);
        return (
          <div className="flex flex-wrap gap-1 text-[10px] text-[var(--ink-muted)]">
            {names.map(name => (
              <span key={name} className="px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)]">
                {name}
              </span>
            ))}
            {hasWO && (
              <span className="px-1.5 py-0.5 rounded-[2px] bg-[var(--surface-sunken)] border border-[var(--rule)] text-[var(--ink-muted)]">
                Week Off
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (cycle) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => openEditCycle(cycle) },
            ...cycleArchive.rowActions({ id: cycle.id, name: cycle.name, isArchived: isRowArchived(cycle) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Sub Tab Navigation ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
        <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] p-1 rounded-[var(--radius-md)] border border-[var(--rule)]">
          <button
            type="button"
            onClick={() => setActiveSubTab('shifts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'shifts'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs border border-[var(--rule)] font-bold'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Layers size={14} className={activeSubTab === 'shifts' ? 'text-[var(--gold-500)]' : 'opacity-60'} />
            <span>Work Shifts (Masters)</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)] font-data font-bold">
              {shifts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cycles')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'cycles'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs border border-[var(--rule)] font-bold'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <RefreshCw size={14} className={activeSubTab === 'cycles' ? 'text-[var(--gold-500)]' : 'opacity-60'} />
            <span>Rotation Cycles</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)] font-data font-bold">
              {cycles.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── View: Shift Masters ───────────────────────────────────────────── */}
      {activeSubTab === 'shifts' && (
        <section className="space-y-4">
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
                setEditingShiftId(null);
                setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', lunchStart: '13:00', lunchEnd: '14:00', breakMinutes: 60, lateGrace: 15, earlyLeaveGrace: 15, colorCode: '#4e73df', halfTime: '' });
                setShiftModalOpen(true);
              },
            }}
          />

          <DataTable
            columns={shiftColumns}
            data={paginatedShifts}
            loading={loading}
            keyExtractor={(item) => item.id}
            selection={{
              selectedRowKeys: selectedShiftIds,
              onChange: (keys) => setSelectedShiftIds(keys),
              bulkActions: shiftArchive.bulkActions(archiveFilter === 'archived'),
            }}
            emptyMessage="No work shifts defined."
            pagination={{
              page,
              pageSize,
              totalCount: filteredShifts.length,
              totalPages: Math.ceil(filteredShifts.length / pageSize) || 1,
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </section>
      )}

      {/* ── View: Shift Cycles ────────────────────────────────────────────── */}
      {activeSubTab === 'cycles' && (
        <section className="space-y-4">
          <DataToolbar
            searchValue={cycleSearch}
            onSearchChange={(v) => { setCycleSearch(v); setCyclePage(1); }}
            searchPlaceholder="Search rotation cycles..."
            archiveFilter={{
              value: cycleArchiveFilter,
              onChange: (v) => { setCycleArchiveFilter(v); setCyclePage(1); },
            }}
            primaryAction={{
              label: 'New Cycle',
              icon: <Plus size={13} />,
              onClick: openCreateCycle,
            }}
          />

          <DataTable
            columns={cycleColumns}
            data={paginatedCycles}
            loading={cyclesLoading}
            keyExtractor={(c) => c.id}
            selection={{
              selectedRowKeys: selectedCycleIds,
              onChange: (keys) => setSelectedCycleIds(keys),
              bulkActions: cycleArchive.bulkActions(cycleArchiveFilter === 'archived'),
            }}
            emptyMessage="No shift rotation cycles defined yet."
            pagination={{
              page: cyclePage,
              pageSize: cyclePageSize,
              totalCount: filteredCycles.length,
              totalPages: Math.ceil(filteredCycles.length / cyclePageSize) || 1,
              onPageChange: setCyclePage,
              onPageSizeChange: (s) => { setCyclePageSize(s); setCyclePage(1); },
            }}
          />
        </section>
      )}

      {/* ── Add / Edit Shift Modal ─────────────────────────────────────────── */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Layers size={16} className="text-[var(--gold-500)]" />
                <span>{editingShiftId ? 'Edit Work Shift' : 'Create Work Shift'}</span>
              </h3>
              <button onClick={() => setShiftModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Shift Name *</label>
                  <input type="text" value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} placeholder="e.g. Night Shift" className="register-input w-full" required />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Shift Code</label>
                  <input type="text" value={newShift.code} onChange={(e) => setNewShift({ ...newShift, code: e.target.value.toUpperCase() })} placeholder="e.g. NS, GEN" className="register-input w-full font-data uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Start Time</label>
                  <input type="time" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} className="register-input w-full font-data" />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">End Time</label>
                  <input type="time" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} className="register-input w-full font-data" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Lunch Start</label>
                  <input type="time" value={newShift.lunchStart} onChange={(e) => setNewShift({ ...newShift, lunchStart: e.target.value })} className="register-input w-full font-data" />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Lunch End</label>
                  <input type="time" value={newShift.lunchEnd} onChange={(e) => setNewShift({ ...newShift, lunchEnd: e.target.value })} className="register-input w-full font-data" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Break (mins)</label>
                  <input type="number" value={newShift.breakMinutes} onChange={(e) => setNewShift({ ...newShift, breakMinutes: Number(e.target.value) })} className="register-input w-full font-data" min={0} max={120} />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Late Grace (mins)</label>
                  <input type="number" value={newShift.lateGrace} onChange={(e) => setNewShift({ ...newShift, lateGrace: Number(e.target.value) })} className="register-input w-full font-data" min={0} max={60} />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Early Leave Grace (mins)</label>
                  <input type="number" value={newShift.earlyLeaveGrace} onChange={(e) => setNewShift({ ...newShift, earlyLeaveGrace: Number(e.target.value) })} className="register-input w-full font-data" min={0} max={60} />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Half Day Cutoff Time</label>
                <input type="time" value={newShift.halfTime || ''} onChange={(e) => setNewShift({ ...newShift, halfTime: e.target.value })} className="register-input w-full font-data" />
                <p className="text-[10px] text-[var(--ink-muted)] mt-1">If not set, it is calculated automatically as the exact midpoint of the shift.</p>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Color Code</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newShift.colorCode} onChange={(e) => setNewShift({ ...newShift, colorCode: e.target.value })} className="w-8 h-8 rounded-[4px] border border-[var(--rule)] cursor-pointer" />
                  <span className="font-data text-[var(--ink-muted)]">{newShift.colorCode}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
                <span className="text-[var(--ink-muted)]">Working Hours:</span>
                <span className="font-data font-bold text-[var(--gold-500)]">
                  {(() => {
                    const [sh, sm] = newShift.startTime.split(':').map(Number);
                    const [eh, em] = newShift.endTime.split(':').map(Number);
                    let spanMins = (eh * 60 + em) - (sh * 60 + sm);
                    if (spanMins < 0) {
                      spanMins += 24 * 60; // Overnight span (crosses midnight)
                    }
                    const netMins = Math.max(0, spanMins - (newShift.breakMinutes || 0));
                    return `${Math.floor(netMins / 60)}h ${netMins % 60}m`;
                  })()}
                </span>
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setShiftModalOpen(false)} className="btn-outline cursor-pointer">Cancel</button>
                <button type="submit" className="btn-primary cursor-pointer">{editingShiftId ? 'Update Shift' : 'Save Shift'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create / Edit Cycle Modal ──────────────────────────────────────── */}
      {cycleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--rule)] p-5 shrink-0">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <RefreshCw size={15} className="text-[var(--gold-500)]" />
                {editingCycleId ? 'Edit Shift Cycle' : 'Create Shift Cycle'}
              </h3>
              <button onClick={() => setCycleModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCycle} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-5 space-y-5">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <label className="block font-medium text-[var(--ink)] mb-1">Cycle Name *</label>
                    <input
                      type="text"
                      required
                      value={cycleForm.name}
                      onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. 3-Shift Weekly, Hospital 4-On 2-Off"
                      className="register-input w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-medium text-[var(--ink)] mb-1">Description</label>
                    <input
                      type="text"
                      value={cycleForm.description}
                      onChange={e => setCycleForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Optional — e.g. Used for factory floor employees"
                      className="register-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1">Cycle Length (days) *</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={cycleForm.cycleLengthDays}
                      onChange={e => handleCycleLengthChange(Number(e.target.value))}
                      className="register-input w-full font-data"
                    />
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">
                      7 = weekly, 21 = 3-week rotation, 6 = 4-on/2-off, etc.
                    </p>
                  </div>
                </div>

                {/* Live preview */}
                {cycleSlots.length > 0 && (
                  <div className="p-3 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px]">
                    <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider mb-1.5">Pattern Preview (×2)</p>
                    <CyclePreviewStrip
                      cycleLengthDays={cycleForm.cycleLengthDays}
                      slots={cycleSlots.map((s, i) => ({
                        slotIndex: i,
                        shiftId: s.shiftId,
                        isWeekOff: s.isWeekOff,
                        shiftName: shifts.find(sh => sh.id === s.shiftId)?.name ?? null,
                        shiftCode: shifts.find(sh => sh.id === s.shiftId)?.code ?? null,
                        colorCode: shifts.find(sh => sh.id === s.shiftId)?.colorCode ?? null,
                      }))}
                    />
                  </div>
                )}

                {/* Per-slot editor */}
                <div>
                  <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider mb-2">Day-by-Day Assignment</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {cycleSlots.map((slot, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 p-2 rounded-[3px] border text-xs transition-colors ${
                          slot.isWeekOff
                            ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                            : 'bg-[var(--paper)] border-[var(--rule)]'
                        }`}
                      >
                        <span className="w-14 font-data text-[var(--ink-muted)] shrink-0">Day {i + 1}</span>
                        <label className="flex items-center gap-1 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={slot.isWeekOff}
                            onChange={e => {
                              const next = [...cycleSlots];
                              next[i] = { ...next[i], isWeekOff: e.target.checked, shiftId: e.target.checked ? null : next[i].shiftId };
                              setCycleSlots(next);
                            }}
                            className="accent-slate-400"
                          />
                          <span className="text-[var(--ink-muted)]">W/Off</span>
                        </label>
                        {!slot.isWeekOff && (
                          <select
                            value={slot.shiftId ?? ''}
                            onChange={e => {
                              const next = [...cycleSlots];
                              next[i] = { ...next[i], shiftId: e.target.value ? Number(e.target.value) : null };
                              setCycleSlots(next);
                            }}
                            className="register-input flex-1 text-xs"
                          >
                            <option value="">— Select Shift —</option>
                            {shifts.map(sh => (
                              <option key={sh.id} value={sh.id}>{sh.name} ({sh.code})</option>
                            ))}
                          </select>
                        )}
                        {slot.isWeekOff && (
                          <span className="flex-1 text-[var(--ink-muted)] italic text-[11px]">Week Off</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--rule)] shrink-0 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setCycleModalOpen(false)} className="btn-outline cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingCycle} className="btn-primary cursor-pointer disabled:opacity-50">
                  {savingCycle ? 'Saving…' : (editingCycleId ? 'Update Cycle' : 'Create Cycle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ──────────────────────────────────────────────── */}
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

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {shiftArchive.dialog}
      {cycleArchive.dialog}
    </div>
  );
};
